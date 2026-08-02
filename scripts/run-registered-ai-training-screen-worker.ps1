#requires -Version 7.4

<#
.SYNOPSIS
Runs the one-shot registered 303 AI training screen and durably publishes its
complete aggregate audit.

.DESCRIPTION
Threat model and authority boundary:

- A Windows Task Scheduler task should launch this worker. Task Scheduler, not
  Codex's shell/tool process, then owns the worker process tree. Running this
  script directly from a long-lived Codex command does not provide that
  detachment guarantee. The task must use an absolute PowerShell 7.4+ path,
  MultipleInstances=IgnoreNew, RestartCount=0, ExecutionTimeLimit=0, no trigger
  or automatic retry, and settings that do not stop on idle or battery changes.
- Within this worker path, the worker provides at-most-once execution for the
  fixed registration across all RunDirectory values. It first creates a
  registration-scoped global claim under LocalApplicationData with
  FileMode.CreateNew, then writes the local launch.claim audit. The global claim
  is never removed. Any failure after it is created consumes the attempt and
  must not be retried with the protected seed interval. This is an operational
  guard, not a cryptographic lock: a direct invocation of the application CLI
  or API can bypass it and is forbidden by the operating procedure.
- The protected application CLI is fixed. The only arguments after
  search-ai-policy.ts are --training-screen and
  --expected-protocol-hash <hash>. No seed, profile, callback, progress, arm, or
  stopping controls are accepted or constructed here.
- ExpectedInfrastructureFingerprint is a separately preregistered SHA-256 over
  the exact worker, entry wrapper, registration, seed ledger, benchmark, and
  Node executable SHA-256 values. It is checked before either harmless Node
  probe and again at the launch and after-run boundaries. This binds the worker
  infrastructure that is intentionally outside the training protocol hash.
- Node stdout remains private in stdout.pending. The worker does not open or
  parse it until Node has exited. Only a complete, schema-validated aggregate
  audit is renamed to result.json. stderr.log remains an audit artifact.
- All temporary and terminal files are created inside RunDirectory, so each
  publication is a same-volume atomic rename. Windows cannot atomically rename
  result.json and success.json as a pair: result.json is the terminal aggregate
  audit if a crash occurs in the narrow window before success.json is published.
- This worker does not make an interrupted experiment restartable. After a
  power loss, logoff termination, worker crash, or I/O failure, an existing
  claim forbids rerunning the protected seeds. Even a complete stdout.pending
  left before result publication is terminal failed evidence here: this script
  exposes no finalize or resume mode, and it never starts a second protected
  process for a claimed RunDirectory.

PreflightOnly performs path, executable, source-hash, artifact-conflict, Node
version, and runtime protocol-hash checks. Its only child processes run Node's
--version probe and import search-ai-policy.ts to print
computeAiPolicyTrainingScreenProtocolHash(); neither can call the screen or any
benchmark. PreflightOnly does not create RunDirectory, launch.claim, or any
audit file and never starts the protected screen.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateNotNullOrEmpty()]
  [string]$RunDirectory,

  [Parameter(Mandatory)]
  [ValidatePattern('^[a-f0-9]{64}$')]
  [string]$ExpectedProtocolHash,

  [Parameter(Mandatory)]
  [ValidatePattern('^[a-f0-9]{64}$')]
  [string]$ExpectedInfrastructureFingerprint,

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$RepoPath = (Join-Path $PSScriptRoot '..'),

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$NodePath = 'node.exe',

  [Parameter()]
  [switch]$PreflightOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$registrationId = 'power-level-offset0-final-conversion-screen-30300001-v1'
$expectedCandidateIds = @(
  'offset0-scouted-shield-break-v1'
  'offset0-safe-tier6-v1'
  'offset0-tier6-refresh-v1'
)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false, $true)
$maximumAggregateStdoutBytes = 1MB

function Get-UtcTimestamp {
  return [DateTimeOffset]::UtcNow.ToString('O')
}

function Resolve-AbsolutePath {
  param(
    [Parameter(Mandatory)]
    [string]$PathValue
  )

  return [System.IO.Path]::GetFullPath($PathValue)
}

function Resolve-NodeExecutable {
  param(
    [Parameter(Mandatory)]
    [string]$RequestedPath
  )

  $containsDirectorySeparator =
    $RequestedPath.Contains([System.IO.Path]::DirectorySeparatorChar) -or
    $RequestedPath.Contains([System.IO.Path]::AltDirectorySeparatorChar)
  if (
    [System.IO.Path]::IsPathFullyQualified($RequestedPath) -or
    $containsDirectorySeparator
  ) {
    $absolutePath = Resolve-AbsolutePath -PathValue $RequestedPath
    if (-not [System.IO.File]::Exists($absolutePath)) {
      throw "Node executable does not exist: $absolutePath"
    }
    return $absolutePath
  }

  $commands = @(Get-Command -Name $RequestedPath -CommandType Application)
  if ($commands.Count -ne 1) {
    throw "Node executable must resolve to exactly one application: $RequestedPath"
  }
  return [System.IO.Path]::GetFullPath($commands[0].Source)
}

function Get-ArtifactPaths {
  param(
    [Parameter(Mandatory)]
    [string]$DirectoryPath
  )

  return [ordered]@{
    Claim = Join-Path $DirectoryPath 'launch.claim'
    WorkerPid = Join-Path $DirectoryPath 'worker.pid.json'
    NodePid = Join-Path $DirectoryPath 'node.pid.json'
    StdoutPending = Join-Path $DirectoryPath 'stdout.pending'
    Stderr = Join-Path $DirectoryPath 'stderr.log'
    NodeExit = Join-Path $DirectoryPath 'node.exit.json'
    Result = Join-Path $DirectoryPath 'result.json'
    Success = Join-Path $DirectoryPath 'success.json'
    Failure = Join-Path $DirectoryPath 'failure.json'
  }
}

function Get-GlobalClaimPath {
  $localApplicationData = [Environment]::GetFolderPath(
    [Environment+SpecialFolder]::LocalApplicationData
  )
  if ([string]::IsNullOrWhiteSpace($localApplicationData)) {
    throw 'LocalApplicationData is unavailable for the registration claim'
  }
  return Join-Path (
    Join-Path (
      Join-Path $localApplicationData 'CodexRuns'
    ) 'registered-ai-training-screen-claims'
  ) (Join-Path $registrationId 'launch.claim')
}

function Get-ArtifactConflicts {
  param(
    [Parameter(Mandatory)]
    [System.Collections.IDictionary]$ArtifactPaths,

    [Parameter(Mandatory)]
    [string]$DirectoryPath
  )

  $conflicts = [System.Collections.Generic.List[string]]::new()
  foreach ($artifactPath in $ArtifactPaths.Values) {
    if (
      [System.IO.File]::Exists([string]$artifactPath) -or
      [System.IO.Directory]::Exists([string]$artifactPath)
    ) {
      $conflicts.Add([string]$artifactPath)
    }
  }
  if ([System.IO.Directory]::Exists($DirectoryPath)) {
    foreach (
      $temporaryPath in
        [System.IO.Directory]::EnumerateFiles(
          $DirectoryPath,
          '.ai-screen-atomic-*.tmp',
          [System.IO.SearchOption]::TopDirectoryOnly
        )
    ) {
      $conflicts.Add($temporaryPath)
    }
  }
  return $conflicts.ToArray()
}

function Write-DurableFile {
  param(
    [Parameter(Mandatory)]
    [string]$Path,

    [Parameter(Mandatory)]
    [byte[]]$Bytes
  )

  $stream = [System.IO.File]::Open(
    $Path,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  try {
    $stream.Write($Bytes, 0, $Bytes.Length)
    $stream.Flush($true)
  } finally {
    $stream.Dispose()
  }
}

function New-AtomicTemporaryPath {
  param(
    [Parameter(Mandatory)]
    [string]$TargetPath
  )

  $directoryPath = [System.IO.Path]::GetDirectoryName($TargetPath)
  return Join-Path $directoryPath (
    '.ai-screen-atomic-{0}.tmp' -f [Guid]::NewGuid().ToString('N')
  )
}

function Write-AtomicText {
  param(
    [Parameter(Mandatory)]
    [string]$Path,

    [Parameter(Mandatory)]
    [AllowEmptyString()]
    [string]$Text
  )

  if ([System.IO.File]::Exists($Path)) {
    throw "Refusing to replace existing audit artifact: $Path"
  }
  $temporaryPath = New-AtomicTemporaryPath -TargetPath $Path
  Write-DurableFile -Path $temporaryPath -Bytes $utf8NoBom.GetBytes($Text)
  [System.IO.File]::Move($temporaryPath, $Path)
}

function Write-AtomicJson {
  param(
    [Parameter(Mandatory)]
    [string]$Path,

    [Parameter(Mandatory)]
    [object]$Value
  )

  $json = ConvertTo-Json -InputObject $Value -Depth 100
  Write-AtomicText -Path $Path -Text ($json + [Environment]::NewLine)
}

function New-LaunchClaim {
  param(
    [Parameter(Mandatory)]
    [string]$Path,

    [Parameter(Mandatory)]
    [object]$Value
  )

  # FileMode.CreateNew is the at-most-once boundary. Even an empty or partial
  # claim left by a crash permanently blocks another protected launch.
  $json = ConvertTo-Json -InputObject $Value -Depth 20
  Write-DurableFile -Path $Path -Bytes $utf8NoBom.GetBytes(
    $json + [Environment]::NewLine
  )
}

function Assert-ExactPropertySet {
  param(
    [Parameter(Mandatory)]
    [object]$Value,

    [Parameter(Mandatory)]
    [string[]]$ExpectedNames,

    [Parameter(Mandatory)]
    [string]$Label
  )

  if ($null -eq $Value) {
    throw "$Label must be an object"
  }
  $expected = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::Ordinal
  )
  foreach ($expectedName in $ExpectedNames) {
    [void]$expected.Add($expectedName)
  }
  $actualCount = 0
  foreach ($property in $Value.PSObject.Properties) {
    $actualCount += 1
    if (-not $expected.Contains($property.Name)) {
      throw "$Label contains unexpected property $($property.Name)"
    }
  }
  if ($actualCount -ne $expected.Count) {
    foreach ($expectedName in $ExpectedNames) {
      if ($null -eq $Value.PSObject.Properties[$expectedName]) {
        throw "$Label is missing property $expectedName"
      }
    }
    throw "$Label property count does not match the fixed schema"
  }
}

function Assert-Boolean {
  param(
    [Parameter(Mandatory)]
    [AllowNull()]
    [object]$Value,

    [Parameter(Mandatory)]
    [string]$Label
  )

  if ($Value -isnot [bool]) {
    throw "$Label must be a JSON boolean"
  }
}

function Assert-Integer {
  param(
    [Parameter(Mandatory)]
    [AllowNull()]
    [object]$Value,

    [Parameter(Mandatory)]
    [string]$Label
  )

  if (
    $Value -isnot [byte] -and
    $Value -isnot [sbyte] -and
    $Value -isnot [int16] -and
    $Value -isnot [uint16] -and
    $Value -isnot [int32] -and
    $Value -isnot [uint32] -and
    $Value -isnot [int64] -and
    $Value -isnot [uint64]
  ) {
    throw "$Label must be a JSON integer"
  }
}

function Assert-NumberOrNull {
  param(
    [Parameter(Mandatory)]
    [AllowNull()]
    [object]$Value,

    [Parameter(Mandatory)]
    [string]$Label
  )

  if ($null -eq $Value) {
    return
  }
  if (
    $Value -isnot [byte] -and
    $Value -isnot [sbyte] -and
    $Value -isnot [int16] -and
    $Value -isnot [uint16] -and
    $Value -isnot [int32] -and
    $Value -isnot [uint32] -and
    $Value -isnot [int64] -and
    $Value -isnot [uint64] -and
    $Value -isnot [single] -and
    $Value -isnot [double] -and
    $Value -isnot [decimal]
  ) {
    throw "$Label must be a JSON number or null"
  }
}

function Assert-Hash {
  param(
    [Parameter(Mandatory)]
    [AllowNull()]
    [object]$Value,

    [Parameter(Mandatory)]
    [string]$Label
  )

  if ($Value -isnot [string] -or $Value -notmatch '^[a-f0-9]{64}$') {
    throw "$Label must be one lowercase 64-hex digest"
  }
}

function Assert-Comparison {
  param(
    [Parameter(Mandatory)]
    [object]$Value,

    [Parameter(Mandatory)]
    [ValidateSet('placement', 'rate')]
    [string]$Kind,

    [Parameter(Mandatory)]
    [string]$Label
  )

  $meanName = if ($Kind -eq 'placement') {
    'meanPlacementDelta'
  } else {
    'meanRateDelta'
  }
  Assert-ExactPropertySet -Value $Value -ExpectedNames @(
    'pairedGames'
    'seedClusters'
    $meanName
    'confidence95'
  ) -Label $Label
  Assert-Integer -Value $Value.pairedGames -Label "$Label.pairedGames"
  Assert-Integer -Value $Value.seedClusters -Label "$Label.seedClusters"
  Assert-NumberOrNull -Value $Value.$meanName -Label "$Label.$meanName"
  if ($null -ne $Value.confidence95) {
    Assert-ExactPropertySet -Value $Value.confidence95 -ExpectedNames @(
      'lower'
      'upper'
    ) -Label "$Label.confidence95"
    Assert-NumberOrNull -Value $Value.confidence95.lower -Label (
      "$Label.confidence95.lower"
    )
    Assert-NumberOrNull -Value $Value.confidence95.upper -Label (
      "$Label.confidence95.upper"
    )
    if (
      $null -eq $Value.confidence95.lower -or
      $null -eq $Value.confidence95.upper
    ) {
      throw "$Label.confidence95 bounds cannot be null"
    }
  }
}

function Assert-VariantSummary {
  param(
    [Parameter(Mandatory)]
    [object]$Value,

    [Parameter(Mandatory)]
    [int]$ExpectedValue,

    [Parameter(Mandatory)]
    [string]$Label
  )

  Assert-ExactPropertySet -Value $Value -ExpectedNames @(
    'value'
    'contentSnapshotSha256'
    'contentSnapshotSha256After'
    'contentSnapshotStable'
    'evaluatorHash'
    'evaluatorHashAfter'
    'evaluatorStable'
    'strategyProfileHash'
    'strategyProfileHashAfter'
    'strategyProfilesStable'
    'scheduledGames'
    'completedGames'
    'drawnGames'
    'truncatedGames'
    'averagePlacement'
    'topFourRate'
    'winRate'
    'comparisonToIncumbent'
    'conservativeComparisonToIncumbent'
    'conservativeTopFourComparisonToIncumbent'
    'conservativeWinRateComparisonToIncumbent'
    'trainingScore'
  ) -Label $Label

  Assert-Integer -Value $Value.value -Label "$Label.value"
  if ([int64]$Value.value -ne $ExpectedValue) {
    throw "$Label.value must equal $ExpectedValue"
  }
  foreach ($hashName in @(
    'contentSnapshotSha256'
    'contentSnapshotSha256After'
    'evaluatorHash'
    'evaluatorHashAfter'
    'strategyProfileHash'
    'strategyProfileHashAfter'
  )) {
    Assert-Hash -Value $Value.$hashName -Label "$Label.$hashName"
  }
  foreach ($booleanName in @(
    'contentSnapshotStable'
    'evaluatorStable'
    'strategyProfilesStable'
  )) {
    Assert-Boolean -Value $Value.$booleanName -Label "$Label.$booleanName"
  }
  foreach ($integerName in @(
    'scheduledGames'
    'completedGames'
    'drawnGames'
    'truncatedGames'
  )) {
    Assert-Integer -Value $Value.$integerName -Label "$Label.$integerName"
  }
  if ([int64]$Value.scheduledGames -ne 512) {
    throw "$Label.scheduledGames must equal 512"
  }
  $accountedGames =
    [int64]$Value.completedGames +
    [int64]$Value.truncatedGames
  if ($accountedGames -ne 512) {
    throw "$Label completed plus truncated games must equal 512"
  }
  if (
    [int64]$Value.drawnGames -lt 0 -or
    [int64]$Value.drawnGames -gt [int64]$Value.completedGames
  ) {
    throw "$Label drawn games must be between zero and completed games"
  }
  foreach ($metricName in @(
    'averagePlacement'
    'topFourRate'
    'winRate'
    'trainingScore'
  )) {
    Assert-NumberOrNull -Value $Value.$metricName -Label "$Label.$metricName"
  }
  Assert-Comparison -Value $Value.comparisonToIncumbent `
    -Kind placement -Label "$Label.comparisonToIncumbent"
  Assert-Comparison -Value $Value.conservativeComparisonToIncumbent `
    -Kind placement -Label "$Label.conservativeComparisonToIncumbent"
  Assert-Comparison -Value $Value.conservativeTopFourComparisonToIncumbent `
    -Kind rate -Label "$Label.conservativeTopFourComparisonToIncumbent"
  Assert-Comparison -Value $Value.conservativeWinRateComparisonToIncumbent `
    -Kind rate -Label "$Label.conservativeWinRateComparisonToIncumbent"
}

function Assert-NoForbiddenJsonProperties {
  param(
    [Parameter(Mandatory)]
    [System.Text.Json.JsonElement]$Element,

    [Parameter(Mandatory)]
    [string]$JsonPath
  )

  if ($Element.ValueKind -eq [System.Text.Json.JsonValueKind]::Object) {
    foreach ($property in $Element.EnumerateObject()) {
      foreach ($forbiddenName in @(
        'games'
        'raw'
        'rawGames'
        'rawGameResults'
      )) {
        if (
          [string]::Equals(
            $property.Name,
            $forbiddenName,
            [System.StringComparison]::OrdinalIgnoreCase
          )
        ) {
          throw "Forbidden raw-game property at $JsonPath.$($property.Name)"
        }
      }
      Assert-NoForbiddenJsonProperties -Element $property.Value -JsonPath (
        "$JsonPath.$($property.Name)"
      )
    }
    return
  }
  if ($Element.ValueKind -eq [System.Text.Json.JsonValueKind]::Array) {
    $itemIndex = 0
    foreach ($item in $Element.EnumerateArray()) {
      Assert-NoForbiddenJsonProperties -Element $item -JsonPath (
        "$JsonPath[$itemIndex]"
      )
      $itemIndex += 1
    }
  }
}

function Assert-FixedTrainingScreenAudit {
  param(
    [Parameter(Mandatory)]
    [object]$Audit,

    [Parameter(Mandatory)]
    [System.Text.Json.JsonElement]$RootElement,

    [Parameter(Mandatory)]
    [string]$ProtocolHash
  )

  Assert-NoForbiddenJsonProperties -Element $RootElement -JsonPath '$'
  Assert-ExactPropertySet -Value $Audit -ExpectedNames @(
    'method'
    'registrationId'
    'protocolHash'
    'protocolHashAfter'
    'protocolStable'
    'requestedExpectedProtocolHash'
    'registrationMatched'
    'contentVersion'
    'contentSnapshotSha256'
    'contentSnapshotSha256After'
    'contentSnapshotStable'
    'policyVersion'
    'evaluatorHash'
    'evaluatorHashAfter'
    'evaluatorStable'
    'searchEvaluatorHash'
    'searchEvaluatorHashAfter'
    'searchEvaluatorStable'
    'strategyProfileHash'
    'strategyProfileHashAfter'
    'strategyProfilesStable'
    'candidateProfileBindingsStable'
    'strategyId'
    'playerId'
    'config'
    'candidateProfileHashes'
    'baseline'
    'candidates'
    'selected'
    'note'
  ) -Label 'result'

  if ($Audit.method -ne 'fixed-candidate-training-screen-v1') {
    throw 'result.method does not identify the fixed training screen'
  }
  if ($Audit.registrationId -ne $registrationId) {
    throw "result.registrationId must equal $registrationId"
  }
  if ($Audit.requestedExpectedProtocolHash -ne $ProtocolHash) {
    throw 'result.requestedExpectedProtocolHash does not match the launch hash'
  }
  if ($Audit.protocolHash -ne $ProtocolHash) {
    throw 'result.protocolHash does not match the launch hash'
  }
  Assert-Hash -Value $Audit.protocolHashAfter -Label 'result.protocolHashAfter'
  foreach ($hashName in @(
    'contentSnapshotSha256'
    'contentSnapshotSha256After'
    'evaluatorHash'
    'evaluatorHashAfter'
    'searchEvaluatorHash'
    'searchEvaluatorHashAfter'
    'strategyProfileHash'
    'strategyProfileHashAfter'
  )) {
    Assert-Hash -Value $Audit.$hashName -Label "result.$hashName"
  }
  foreach ($booleanName in @(
    'protocolStable'
    'registrationMatched'
    'contentSnapshotStable'
    'evaluatorStable'
    'searchEvaluatorStable'
    'strategyProfilesStable'
    'candidateProfileBindingsStable'
  )) {
    Assert-Boolean -Value $Audit.$booleanName -Label "result.$booleanName"
  }
  if ($Audit.strategyId -ne 'powerLevel') {
    throw 'result.strategyId must equal powerLevel'
  }
  if ($Audit.playerId -ne 'player-5') {
    throw 'result.playerId must equal player-5'
  }
  if ($Audit.contentVersion -isnot [string] -or $Audit.contentVersion.Length -eq 0) {
    throw 'result.contentVersion must be a non-empty string'
  }
  if ($Audit.policyVersion -isnot [string] -or $Audit.policyVersion.Length -eq 0) {
    throw 'result.policyVersion must be a non-empty string'
  }
  if ($Audit.note -isnot [string] -or $Audit.note.Length -eq 0) {
    throw 'result.note must be a non-empty string'
  }

  Assert-ExactPropertySet -Value $Audit.config -ExpectedNames @(
    'seeds'
    'startSeed'
    'maxRounds'
    'rotationsPerSeed'
    'scheduledGames'
    'minimumPlacementImprovement'
    'topFourNoninferiorityGuard'
    'winRateNoninferiorityGuard'
  ) -Label 'result.config'
  foreach ($integerName in @(
    'seeds'
    'startSeed'
    'maxRounds'
    'rotationsPerSeed'
    'scheduledGames'
  )) {
    Assert-Integer -Value $Audit.config.$integerName -Label (
      "result.config.$integerName"
    )
  }
  if (
    [int64]$Audit.config.seeds -ne 64 -or
    [int64]$Audit.config.startSeed -ne 30300001 -or
    [int64]$Audit.config.maxRounds -ne 100 -or
    [int64]$Audit.config.rotationsPerSeed -ne 8 -or
    [int64]$Audit.config.scheduledGames -ne 512
  ) {
    throw 'result.config does not match the immutable 303 registration'
  }
  foreach ($numberName in @(
    'minimumPlacementImprovement'
    'topFourNoninferiorityGuard'
    'winRateNoninferiorityGuard'
  )) {
    Assert-NumberOrNull -Value $Audit.config.$numberName -Label (
      "result.config.$numberName"
    )
  }
  if (
    [double]$Audit.config.minimumPlacementImprovement -ne 0.1 -or
    [double]$Audit.config.topFourNoninferiorityGuard -ne 0.01 -or
    [double]$Audit.config.winRateNoninferiorityGuard -ne 0.02
  ) {
    throw 'result.config guardrails do not match the immutable registration'
  }

  Assert-VariantSummary -Value $Audit.baseline -ExpectedValue -1 `
    -Label 'result.baseline'

  $profileHashes = @($Audit.candidateProfileHashes)
  $candidates = @($Audit.candidates)
  if ($profileHashes.Count -ne 3 -or $candidates.Count -ne 3) {
    throw 'result must contain exactly three fixed candidates and profile hashes'
  }
  for ($candidateIndex = 0; $candidateIndex -lt 3; $candidateIndex += 1) {
    $candidateId = $expectedCandidateIds[$candidateIndex]
    $profileHash = $profileHashes[$candidateIndex]
    $candidate = $candidates[$candidateIndex]

    Assert-ExactPropertySet -Value $profileHash -ExpectedNames @(
      'candidateId'
      'strategyProfileHash'
    ) -Label "result.candidateProfileHashes[$candidateIndex]"
    if ($profileHash.candidateId -ne $candidateId) {
      throw "candidate profile hash order must contain $candidateId"
    }
    Assert-Hash -Value $profileHash.strategyProfileHash -Label (
      "result.candidateProfileHashes[$candidateIndex].strategyProfileHash"
    )

    Assert-ExactPropertySet -Value $candidate -ExpectedNames @(
      'candidateId'
      'profile'
      'expectedStrategyProfileHash'
      'profileBindingStable'
      'summary'
      'qualified'
      'qualificationReasons'
    ) -Label "result.candidates[$candidateIndex]"
    if ($candidate.candidateId -ne $candidateId) {
      throw "candidate order must contain $candidateId"
    }
    Assert-Hash -Value $candidate.expectedStrategyProfileHash -Label (
      "result.candidates[$candidateIndex].expectedStrategyProfileHash"
    )
    Assert-Boolean -Value $candidate.profileBindingStable -Label (
      "result.candidates[$candidateIndex].profileBindingStable"
    )
    Assert-Boolean -Value $candidate.qualified -Label (
      "result.candidates[$candidateIndex].qualified"
    )
    if ($null -eq $candidate.profile) {
      throw "result.candidates[$candidateIndex].profile must be an object"
    }
    if ($candidate.profile.id -ne 'powerLevel') {
      throw "candidate $candidateId must bind the powerLevel profile"
    }
    if ([int64]$candidate.profile.upgradeRoundOffset -ne 0) {
      throw "candidate $candidateId must use upgradeRoundOffset 0"
    }
    switch ($candidateId) {
      'offset0-scouted-shield-break-v1' {
        if (
          [double]$candidate.profile.scoutingWeight -ne 0.5 -or
          [int64]$candidate.profile.safeTierSixUpgradeAcceleration -ne 0 -or
          [int64]$candidate.profile.tierSixRefreshBonus -ne 0
        ) {
          throw "candidate $candidateId profile discriminators changed"
        }
      }
      'offset0-safe-tier6-v1' {
        if (
          [double]$candidate.profile.scoutingWeight -ne 0.45 -or
          [int64]$candidate.profile.safeTierSixUpgradeAcceleration -ne 1 -or
          [int64]$candidate.profile.tierSixRefreshBonus -ne 0
        ) {
          throw "candidate $candidateId profile discriminators changed"
        }
      }
      'offset0-tier6-refresh-v1' {
        if (
          [double]$candidate.profile.scoutingWeight -ne 0.45 -or
          [int64]$candidate.profile.safeTierSixUpgradeAcceleration -ne 0 -or
          [int64]$candidate.profile.tierSixRefreshBonus -ne 1
        ) {
          throw "candidate $candidateId profile discriminators changed"
        }
      }
    }
    foreach ($reason in @($candidate.qualificationReasons)) {
      if ($reason -isnot [string]) {
        throw "candidate $candidateId qualificationReasons must be strings"
      }
    }
    Assert-VariantSummary -Value $candidate.summary -ExpectedValue 0 -Label (
      "result.candidates[$candidateIndex].summary"
    )
  }

  if ($null -ne $Audit.selected -and $Audit.selected -notin $expectedCandidateIds) {
    throw 'result.selected is not null or one of the three fixed candidates'
  }
}

function Test-SelectionEvidenceUsable {
  param(
    [Parameter(Mandatory)]
    [object]$Audit
  )

  if (-not (
    [bool]$Audit.registrationMatched -and
    [bool]$Audit.protocolStable -and
    $Audit.protocolHash -ceq $Audit.protocolHashAfter -and
    [bool]$Audit.contentSnapshotStable -and
    $Audit.contentSnapshotSha256 -ceq $Audit.contentSnapshotSha256After -and
    [bool]$Audit.evaluatorStable -and
    $Audit.evaluatorHash -ceq $Audit.evaluatorHashAfter -and
    [bool]$Audit.searchEvaluatorStable -and
    $Audit.searchEvaluatorHash -ceq $Audit.searchEvaluatorHashAfter -and
    [bool]$Audit.strategyProfilesStable -and
    $Audit.strategyProfileHash -ceq $Audit.strategyProfileHashAfter -and
    [bool]$Audit.candidateProfileBindingsStable -and
    [bool]$Audit.baseline.contentSnapshotStable -and
    $Audit.baseline.contentSnapshotSha256 -ceq
      $Audit.baseline.contentSnapshotSha256After -and
    [bool]$Audit.baseline.evaluatorStable -and
    $Audit.baseline.evaluatorHash -ceq $Audit.baseline.evaluatorHashAfter -and
    [bool]$Audit.baseline.strategyProfilesStable -and
    $Audit.baseline.strategyProfileHash -ceq
      $Audit.baseline.strategyProfileHashAfter
  )) {
    return $false
  }

  $candidates = @($Audit.candidates)
  $profileHashes = @($Audit.candidateProfileHashes)
  for ($candidateIndex = 0; $candidateIndex -lt 3; $candidateIndex += 1) {
    $candidate = $candidates[$candidateIndex]
    $profileHash = $profileHashes[$candidateIndex]
    if (-not (
      $candidate.expectedStrategyProfileHash -ceq
        $profileHash.strategyProfileHash -and
      [bool]$candidate.profileBindingStable -and
      [bool]$candidate.summary.contentSnapshotStable -and
      $candidate.summary.contentSnapshotSha256 -ceq
        $candidate.summary.contentSnapshotSha256After -and
      [bool]$candidate.summary.evaluatorStable -and
      $candidate.summary.evaluatorHash -ceq
        $candidate.summary.evaluatorHashAfter -and
      [bool]$candidate.summary.strategyProfilesStable -and
      $candidate.summary.strategyProfileHash -ceq
        $candidate.summary.strategyProfileHashAfter
    )) {
      return $false
    }
  }
  return $true
}

function Get-Sha256 {
  param(
    [Parameter(Mandatory)]
    [byte[]]$Bytes
  )

  return [Convert]::ToHexString(
    [System.Security.Cryptography.SHA256]::HashData($Bytes)
  ).ToLowerInvariant()
}

function Get-FileSha256 {
  param(
    [Parameter(Mandatory)]
    [string]$Path
  )

  if (-not [System.IO.File]::Exists($Path)) {
    throw "Cannot hash missing source file: $Path"
  }
  return Get-Sha256 -Bytes ([System.IO.File]::ReadAllBytes($Path))
}

function Get-InfrastructureFingerprint {
  param(
    [Parameter(Mandatory)]
    [System.Collections.IDictionary]$SourceSha256
  )

  # Exact canonical input, with LF separators and no trailing newline:
  # worker=<sha>\nentry=<sha>\nregistration=<sha>\nseedLedger=<sha>\n
  # benchmark=<sha>\nnode=<sha>
  $canonicalInput = @(
    'worker=' + [string]$SourceSha256.worker
    'entry=' + [string]$SourceSha256.entry
    'registration=' + [string]$SourceSha256.registration
    'seedLedger=' + [string]$SourceSha256.seedLedger
    'benchmark=' + [string]$SourceSha256.benchmark
    'node=' + [string]$SourceSha256.node
  ) -join "`n"
  return Get-Sha256 -Bytes $utf8NoBom.GetBytes($canonicalInput)
}

function Get-SourceFingerprint {
  param(
    [Parameter(Mandatory)]
    [string]$WorkerPath,

    [Parameter(Mandatory)]
    [string]$EntryPath,

    [Parameter(Mandatory)]
    [string]$RegistrationPath,

    [Parameter(Mandatory)]
    [string]$SeedLedgerPath,

    [Parameter(Mandatory)]
    [string]$BenchmarkPath,

    [Parameter(Mandatory)]
    [string]$ExecutablePath
  )

  return [ordered]@{
    worker = Get-FileSha256 -Path $WorkerPath
    entry = Get-FileSha256 -Path $EntryPath
    registration = Get-FileSha256 -Path $RegistrationPath
    seedLedger = Get-FileSha256 -Path $SeedLedgerPath
    benchmark = Get-FileSha256 -Path $BenchmarkPath
    node = Get-FileSha256 -Path $ExecutablePath
  }
}

function Test-FingerprintEqual {
  param(
    [Parameter(Mandatory)]
    [System.Collections.IDictionary]$Expected,

    [Parameter(Mandatory)]
    [System.Collections.IDictionary]$Actual
  )

  foreach ($name in @(
    'worker'
    'entry'
    'registration'
    'seedLedger'
    'benchmark'
    'node'
  )) {
    if ($Expected[$name] -cne $Actual[$name]) {
      return $false
    }
  }
  return $true
}

function Assert-FingerprintEqual {
  param(
    [Parameter(Mandatory)]
    [System.Collections.IDictionary]$Expected,

    [Parameter(Mandatory)]
    [System.Collections.IDictionary]$Actual,

    [Parameter(Mandatory)]
    [string]$Boundary
  )

  foreach ($name in @(
    'worker'
    'entry'
    'registration'
    'seedLedger'
    'benchmark'
    'node'
  )) {
    if ($Expected[$name] -cne $Actual[$name]) {
      throw "Source fingerprint changed at ${Boundary}: $name"
    }
  }
}

function Get-ProtocolHashProbe {
  param(
    [Parameter(Mandatory)]
    [string]$ExecutablePath,

    [Parameter(Mandatory)]
    [string]$WorkingDirectory,

    [Parameter(Mandatory)]
    [string]$EntryScriptPath
  )

  $entryScriptUri = [System.Uri]::new($EntryScriptPath).AbsoluteUri
  $entryScriptUriJson = ConvertTo-Json -InputObject $entryScriptUri -Compress
  $probeSource = @"
import { computeAiPolicyTrainingScreenProtocolHash } from $entryScriptUriJson;
process.stdout.write(computeAiPolicyTrainingScreenProtocolHash());
"@
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $ExecutablePath
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = $utf8NoBom
  $startInfo.StandardErrorEncoding = $utf8NoBom
  $startInfo.Environment['NODE_OPTIONS'] = ''
  $startInfo.Environment['NODE_PATH'] = ''
  foreach ($argument in @(
    '--experimental-strip-types'
    '--input-type=module'
    '--eval'
    $probeSource
  )) {
    [void]$startInfo.ArgumentList.Add($argument)
  }

  $probeProcess = [System.Diagnostics.Process]::new()
  $probeProcess.StartInfo = $startInfo
  try {
    if (-not $probeProcess.Start()) {
      throw 'Protocol hash probe process did not start'
    }
    $stdoutTask = $probeProcess.StandardOutput.ReadToEndAsync()
    $stderrTask = $probeProcess.StandardError.ReadToEndAsync()
    $probeProcess.WaitForExit()
    $probeStdout = $stdoutTask.GetAwaiter().GetResult()
    $probeStderr = $stderrTask.GetAwaiter().GetResult()
    if ($probeProcess.ExitCode -ne 0) {
      throw "Protocol hash probe exited with code $($probeProcess.ExitCode)"
    }
    if ($probeStderr.Length -ne 0) {
      throw 'Protocol hash probe wrote unexpected stderr'
    }
    if (
      $probeStdout.Length -ne 64 -or
      $probeStdout -notmatch '^[a-f0-9]{64}$'
    ) {
      throw 'Protocol hash probe stdout was not exactly one lowercase 64-hex digest'
    }
    return $probeStdout
  } finally {
    $probeProcess.Dispose()
  }
}

function Get-NodeVersionProbe {
  param(
    [Parameter(Mandatory)]
    [string]$ExecutablePath,

    [Parameter(Mandatory)]
    [string]$WorkingDirectory
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $ExecutablePath
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = $utf8NoBom
  $startInfo.StandardErrorEncoding = $utf8NoBom
  $startInfo.Environment['NODE_OPTIONS'] = ''
  $startInfo.Environment['NODE_PATH'] = ''
  [void]$startInfo.ArgumentList.Add('--version')

  $versionProcess = [System.Diagnostics.Process]::new()
  $versionProcess.StartInfo = $startInfo
  try {
    if (-not $versionProcess.Start()) {
      throw 'Node version probe process did not start'
    }
    $stdoutTask = $versionProcess.StandardOutput.ReadToEndAsync()
    $stderrTask = $versionProcess.StandardError.ReadToEndAsync()
    $versionProcess.WaitForExit()
    $versionStdout = $stdoutTask.GetAwaiter().GetResult()
    $versionStderr = $stderrTask.GetAwaiter().GetResult()
    if ($versionProcess.ExitCode -ne 0) {
      throw "Node version probe exited with code $($versionProcess.ExitCode)"
    }
    if ($versionStderr.Length -ne 0) {
      throw 'Node version probe wrote unexpected stderr'
    }
    if (
      $versionStdout -notmatch
      '^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?\r?\n?$'
    ) {
      throw 'Node version probe stdout was not one semantic version'
    }
    return $versionStdout.TrimEnd([char[]]"`r`n")
  } finally {
    $versionProcess.Dispose()
  }
}

$resolvedRunDirectory = $null
$resolvedRepoPath = $null
$resolvedNodePath = $null
$artifactPaths = $null
$globalClaimPath = $null
$claimCreated = $false
$resultPublished = $false
$nodeProcess = $null
$nodeExitCode = $null
$infrastructureFingerprintBeforeProbe = $null
$infrastructureFingerprintAfterProbe = $null
$infrastructureFingerprintAtLaunch = $null
$infrastructureFingerprintAfterRun = $null
$runId = [Guid]::NewGuid().ToString('N')
$stage = 'preflight'

try {
  $resolvedRunDirectory = Resolve-AbsolutePath -PathValue $RunDirectory
  $resolvedRepoPath = Resolve-AbsolutePath -PathValue $RepoPath
  $resolvedNodePath = Resolve-NodeExecutable -RequestedPath $NodePath
  if (-not [System.IO.Directory]::Exists($resolvedRepoPath)) {
    throw "Repository directory does not exist: $resolvedRepoPath"
  }
  $entryScriptPath = Join-Path $resolvedRepoPath 'scripts\search-ai-policy.ts'
  $registrationSourcePath = Join-Path `
    $resolvedRepoPath `
    'scripts\ai-training-screen-registration.ts'
  $seedLedgerSourcePath = Join-Path `
    $resolvedRepoPath `
    'scripts\ai-seed-ledger.ts'
  $benchmarkSourcePath = Join-Path $resolvedRepoPath 'scripts\benchmark-ai.ts'
  foreach ($requiredSourcePath in @(
    $entryScriptPath
    $registrationSourcePath
    $seedLedgerSourcePath
    $benchmarkSourcePath
    $PSCommandPath
  )) {
    if (-not [System.IO.File]::Exists($requiredSourcePath)) {
      throw "Required worker source does not exist: $requiredSourcePath"
    }
  }
  $repoBoundary =
    $resolvedRepoPath.TrimEnd(
      [System.IO.Path]::DirectorySeparatorChar,
      [System.IO.Path]::AltDirectorySeparatorChar
    ) + [System.IO.Path]::DirectorySeparatorChar
  if (
    [string]::Equals(
      $resolvedRunDirectory,
      $resolvedRepoPath,
      [System.StringComparison]::OrdinalIgnoreCase
    ) -or
    $resolvedRunDirectory.StartsWith(
      $repoBoundary,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw 'RunDirectory must be outside RepoPath so audit artifacts cannot enter Git'
  }
  if (
    [System.IO.File]::Exists($resolvedRunDirectory) -and
    -not [System.IO.Directory]::Exists($resolvedRunDirectory)
  ) {
    throw "RunDirectory is an existing file: $resolvedRunDirectory"
  }
  $artifactPaths = Get-ArtifactPaths -DirectoryPath $resolvedRunDirectory
  $globalClaimPath = Get-GlobalClaimPath
  $conflicts = @(
    Get-ArtifactConflicts `
      -ArtifactPaths $artifactPaths `
      -DirectoryPath $resolvedRunDirectory
  )
  if (
    [System.IO.File]::Exists($globalClaimPath) -or
    [System.IO.Directory]::Exists($globalClaimPath)
  ) {
    $conflicts += $globalClaimPath
  }
  if ($conflicts.Count -gt 0) {
    throw (
      'RunDirectory already contains one-shot artifacts; no rerun is allowed: ' +
      ($conflicts -join ', ')
    )
  }

  # These are the complete application arguments. The harmless probes below
  # never use these arguments or invoke a screen.
  $protectedApplicationArguments = @(
    '--training-screen'
    '--expected-protocol-hash'
    $ExpectedProtocolHash
  )
  if (
    $protectedApplicationArguments.Count -ne 3 -or
    $protectedApplicationArguments[0] -ne '--training-screen' -or
    $protectedApplicationArguments[1] -ne '--expected-protocol-hash' -or
    $protectedApplicationArguments[2] -ne $ExpectedProtocolHash
  ) {
    throw 'Internal protected CLI construction changed'
  }
  $sourceSha256 = Get-SourceFingerprint `
    -WorkerPath $PSCommandPath `
    -EntryPath $entryScriptPath `
    -RegistrationPath $registrationSourcePath `
    -SeedLedgerPath $seedLedgerSourcePath `
    -BenchmarkPath $benchmarkSourcePath `
    -ExecutablePath $resolvedNodePath
  $infrastructureFingerprintBeforeProbe = Get-InfrastructureFingerprint `
    -SourceSha256 $sourceSha256
  if (
    $infrastructureFingerprintBeforeProbe -cne
      $ExpectedInfrastructureFingerprint
  ) {
    throw (
      'ExpectedInfrastructureFingerprint does not match the pre-probe ' +
      'worker infrastructure fingerprint'
    )
  }
  $cliFingerprintInput = [ordered]@{
    executablePath = $resolvedNodePath
    runtimeArguments = @(
      '--experimental-strip-types'
      $entryScriptPath
    )
    applicationArguments = $protectedApplicationArguments
  }
  $cliFingerprintJson = ConvertTo-Json `
    -InputObject $cliFingerprintInput `
    -Depth 10 `
    -Compress
  $cliFingerprintSha256 = Get-Sha256 -Bytes (
    $utf8NoBom.GetBytes($cliFingerprintJson)
  )

  $stage = 'node-version-probe'
  $nodeVersion = Get-NodeVersionProbe `
    -ExecutablePath $resolvedNodePath `
    -WorkingDirectory $resolvedRepoPath

  $stage = 'protocol-hash-probe'
  $actualProtocolHash = Get-ProtocolHashProbe `
    -ExecutablePath $resolvedNodePath `
    -WorkingDirectory $resolvedRepoPath `
    -EntryScriptPath $entryScriptPath
  if ($actualProtocolHash -ne $ExpectedProtocolHash) {
    throw 'ExpectedProtocolHash does not match the harmless runtime protocol probe'
  }
  $sourceSha256AfterProbe = Get-SourceFingerprint `
    -WorkerPath $PSCommandPath `
    -EntryPath $entryScriptPath `
    -RegistrationPath $registrationSourcePath `
    -SeedLedgerPath $seedLedgerSourcePath `
    -BenchmarkPath $benchmarkSourcePath `
    -ExecutablePath $resolvedNodePath
  Assert-FingerprintEqual `
    -Expected $sourceSha256 `
    -Actual $sourceSha256AfterProbe `
    -Boundary 'protocol-hash-probe'
  $infrastructureFingerprintAfterProbe = Get-InfrastructureFingerprint `
    -SourceSha256 $sourceSha256AfterProbe
  if (
    $infrastructureFingerprintAfterProbe -cne
      $ExpectedInfrastructureFingerprint
  ) {
    throw 'Infrastructure fingerprint changed during the harmless probes'
  }

  if ($PreflightOnly) {
    $preflightAudit = [ordered]@{
      schemaVersion = 1
      mode = 'preflight-only'
      checkedAtUtc = Get-UtcTimestamp
      ready = $true
      registrationId = $registrationId
      runDirectory = $resolvedRunDirectory
      runDirectoryExists = [System.IO.Directory]::Exists($resolvedRunDirectory)
      globalClaimPath = $globalClaimPath
      globalClaimExists = $false
      repoPath = $resolvedRepoPath
      nodePath = $resolvedNodePath
      nodeVersion = $nodeVersion
      entryScriptPath = $entryScriptPath
      protocolProbeHash = $actualProtocolHash
      expectedInfrastructureFingerprint = $ExpectedInfrastructureFingerprint
      actualInfrastructureFingerprint = $infrastructureFingerprintAfterProbe
      infrastructureFingerprintBeforeProbe = `
        $infrastructureFingerprintBeforeProbe
      infrastructureFingerprintAfterProbe = `
        $infrastructureFingerprintAfterProbe
      sourceSha256BeforeProbe = $sourceSha256
      sourceSha256AfterProbe = $sourceSha256AfterProbe
      cliFingerprintSha256 = $cliFingerprintSha256
      protectedApplicationArguments = @(
        '--training-screen'
        '--expected-protocol-hash'
        $ExpectedProtocolHash
      )
      claimCreated = $false
      nodeStarted = $false
    }
    Write-Output (ConvertTo-Json -InputObject $preflightAudit -Depth 10)
    return
  }

  [void][System.IO.Directory]::CreateDirectory($resolvedRunDirectory)
  [void][System.IO.Directory]::CreateDirectory(
    [System.IO.Path]::GetDirectoryName($globalClaimPath)
  )
  $workerProcess = [System.Diagnostics.Process]::GetCurrentProcess()
  $workerStartedAtUtc = $workerProcess.StartTime.ToUniversalTime().ToString('O')

  $stage = 'claim'
  $claimAudit = [ordered]@{
    schemaVersion = 1
    registrationId = $registrationId
    runId = $runId
    claimedAtUtc = Get-UtcTimestamp
    expectedProtocolHash = $ExpectedProtocolHash
    globalClaimPath = $globalClaimPath
    localClaimPath = $artifactPaths.Claim
    runDirectory = $resolvedRunDirectory
    repoPath = $resolvedRepoPath
    nodePath = $resolvedNodePath
    nodeVersion = $nodeVersion
    entryScriptPath = $entryScriptPath
    protocolProbeHash = $actualProtocolHash
    expectedInfrastructureFingerprint = $ExpectedInfrastructureFingerprint
    actualInfrastructureFingerprint = $infrastructureFingerprintAfterProbe
    infrastructureFingerprintBeforeProbe = `
      $infrastructureFingerprintBeforeProbe
    infrastructureFingerprintAfterProbe = `
      $infrastructureFingerprintAfterProbe
    sourceSha256BeforeProbe = $sourceSha256
    sourceSha256AfterProbe = $sourceSha256AfterProbe
    cliFingerprintSha256 = $cliFingerprintSha256
    workerPid = $workerProcess.Id
    workerStartedAtUtc = $workerStartedAtUtc
    semantics = 'worker-local-guard-is-permanent-and-post-claim-failure-forbids-rerun'
    authorityScope = 'this-worker-path-across-all-run-directories'
    bypassWarning = 'direct-application-cli-or-api-invocation-is-outside-this-guard'
  }
  # The registration-scoped global claim is the execution authority for this
  # worker path. It is created before the RunDirectory-local audit claim, so
  # changing RunDirectory cannot obtain a second execution through this worker.
  New-LaunchClaim -Path $globalClaimPath -Value $claimAudit
  $claimCreated = $true
  New-LaunchClaim -Path $artifactPaths.Claim -Value $claimAudit

  $stage = 'worker-pid-audit'
  Write-AtomicJson -Path $artifactPaths.WorkerPid -Value ([ordered]@{
    schemaVersion = 1
    registrationId = $registrationId
    runId = $runId
    pid = $workerProcess.Id
    startedAtUtc = $workerStartedAtUtc
    recordedAtUtc = Get-UtcTimestamp
    workerPath = $PSCommandPath
    workerSha256 = $sourceSha256.worker
    expectedInfrastructureFingerprint = $ExpectedInfrastructureFingerprint
    actualInfrastructureFingerprint = $infrastructureFingerprintAfterProbe
    nodePath = $resolvedNodePath
    nodeVersion = $nodeVersion
    nodeSha256 = $sourceSha256.node
  })

  $stage = 'launch-fingerprint-check'
  $sourceSha256AtLaunch = Get-SourceFingerprint `
    -WorkerPath $PSCommandPath `
    -EntryPath $entryScriptPath `
    -RegistrationPath $registrationSourcePath `
    -SeedLedgerPath $seedLedgerSourcePath `
    -BenchmarkPath $benchmarkSourcePath `
    -ExecutablePath $resolvedNodePath
  Assert-FingerprintEqual `
    -Expected $sourceSha256 `
    -Actual $sourceSha256AtLaunch `
    -Boundary 'protected-node-launch'
  $infrastructureFingerprintAtLaunch = Get-InfrastructureFingerprint `
    -SourceSha256 $sourceSha256AtLaunch
  if (
    $infrastructureFingerprintAtLaunch -cne
      $ExpectedInfrastructureFingerprint
  ) {
    throw 'Infrastructure fingerprint changed before the protected Node launch'
  }

  if ($entryScriptPath.Contains('"')) {
    throw 'Entry script path contains an unsupported quote character'
  }
  $nodeArgumentString =
    '--experimental-strip-types "{0}" --training-screen ' +
    '--expected-protocol-hash {1}'
  $nodeArgumentString = $nodeArgumentString -f (
    $entryScriptPath
  ), $ExpectedProtocolHash

  $stage = 'node-launch'
  $nodeProcess = Start-Process `
    -FilePath $resolvedNodePath `
    -ArgumentList $nodeArgumentString `
    -WorkingDirectory $resolvedRepoPath `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $artifactPaths.StdoutPending `
    -RedirectStandardError $artifactPaths.Stderr `
    -Environment @{
      NODE_OPTIONS = ''
      NODE_PATH = ''
    }
  $nodeStartedAtUtc = $nodeProcess.StartTime.ToUniversalTime().ToString('O')

  $stage = 'node-pid-audit'
  Write-AtomicJson -Path $artifactPaths.NodePid -Value ([ordered]@{
    schemaVersion = 1
    registrationId = $registrationId
    runId = $runId
    pid = $nodeProcess.Id
    startedAtUtc = $nodeStartedAtUtc
    recordedAtUtc = Get-UtcTimestamp
    executablePath = $resolvedNodePath
    nodeVersion = $nodeVersion
    workingDirectory = $resolvedRepoPath
    runtimeArguments = @(
      '--experimental-strip-types'
      $entryScriptPath
    )
    applicationArguments = $protectedApplicationArguments
    cliFingerprintSha256 = $cliFingerprintSha256
    expectedInfrastructureFingerprint = $ExpectedInfrastructureFingerprint
    actualInfrastructureFingerprint = $infrastructureFingerprintAtLaunch
    sourceSha256 = $sourceSha256AtLaunch
    stdoutPath = $artifactPaths.StdoutPending
    stderrPath = $artifactPaths.Stderr
  })

  $stage = 'node-wait'
  $nodeProcess.WaitForExit()
  $nodeExitCode = $nodeProcess.ExitCode
  $nodeExitedAtUtc = Get-UtcTimestamp

  $stage = 'after-run-infrastructure-audit'
  $infrastructureAuditErrors = [System.Collections.Generic.List[string]]::new()
  $sourceSha256AfterRun = $null
  try {
    $sourceSha256AfterRun = Get-SourceFingerprint `
      -WorkerPath $PSCommandPath `
      -EntryPath $entryScriptPath `
      -RegistrationPath $registrationSourcePath `
      -SeedLedgerPath $seedLedgerSourcePath `
      -BenchmarkPath $benchmarkSourcePath `
      -ExecutablePath $resolvedNodePath
    $infrastructureFingerprintAfterRun = Get-InfrastructureFingerprint `
      -SourceSha256 $sourceSha256AfterRun
    if (
      $infrastructureFingerprintAfterRun -cne
        $ExpectedInfrastructureFingerprint
    ) {
      $infrastructureAuditErrors.Add(
        'after-run infrastructure fingerprint differs from the preregistered value'
      )
    }
  } catch {
    $infrastructureAuditErrors.Add(
      'after-run source fingerprint failed: ' + $_.Exception.Message
    )
  }

  $nodeVersionAfterRun = $null
  if (
    $null -ne $sourceSha256AfterRun -and
    $sourceSha256AtLaunch.node -ceq $sourceSha256AfterRun.node
  ) {
    try {
      $nodeVersionAfterRun = Get-NodeVersionProbe `
        -ExecutablePath $resolvedNodePath `
        -WorkingDirectory $resolvedRepoPath
    } catch {
      $infrastructureAuditErrors.Add(
        'after-run Node version probe failed: ' + $_.Exception.Message
      )
    }
  } else {
    $infrastructureAuditErrors.Add(
      'after-run Node executable hash is unavailable or changed; version probe skipped'
    )
  }
  $infrastructureStable = [bool](
    $infrastructureAuditErrors.Count -eq 0 -and
    $null -ne $sourceSha256AfterRun -and
    (Test-FingerprintEqual `
      -Expected $sourceSha256AtLaunch `
      -Actual $sourceSha256AfterRun) -and
    $infrastructureFingerprintAtLaunch -ceq
      $ExpectedInfrastructureFingerprint -and
    $infrastructureFingerprintAfterRun -ceq
      $ExpectedInfrastructureFingerprint -and
    $nodeVersion -ceq $nodeVersionAfterRun
  )

  $stage = 'node-exit-audit'
  Write-AtomicJson -Path $artifactPaths.NodeExit -Value ([ordered]@{
    schemaVersion = 1
    registrationId = $registrationId
    runId = $runId
    pid = $nodeProcess.Id
    startedAtUtc = $nodeStartedAtUtc
    exitedAtUtc = $nodeExitedAtUtc
    exitCode = $nodeExitCode
    recordedAtUtc = Get-UtcTimestamp
    nodeVersionBeforeRun = $nodeVersion
    nodeVersionAfterRun = $nodeVersionAfterRun
    expectedInfrastructureFingerprint = $ExpectedInfrastructureFingerprint
    actualInfrastructureFingerprint = $infrastructureFingerprintAfterRun
    infrastructureFingerprintBeforeProbe = `
      $infrastructureFingerprintBeforeProbe
    infrastructureFingerprintAfterProbe = `
      $infrastructureFingerprintAfterProbe
    infrastructureFingerprintAtLaunch = $infrastructureFingerprintAtLaunch
    infrastructureFingerprintAfterRun = $infrastructureFingerprintAfterRun
    sourceSha256BeforeProbe = $sourceSha256
    sourceSha256AfterProbe = $sourceSha256AfterProbe
    sourceSha256AtLaunch = $sourceSha256AtLaunch
    sourceSha256AfterRun = $sourceSha256AfterRun
    infrastructureStable = $infrastructureStable
    infrastructureAuditErrors = $infrastructureAuditErrors.ToArray()
  })
  if ($nodeExitCode -ne 0) {
    throw "Registered training screen Node process exited with code $nodeExitCode"
  }

  $stage = 'stderr-validation'
  if (-not [System.IO.File]::Exists($artifactPaths.Stderr)) {
    throw 'Node exited successfully without stderr.log audit artifact'
  }
  $stderrInfo = [System.IO.FileInfo]::new($artifactPaths.Stderr)
  if ($stderrInfo.Length -ne 0) {
    throw 'Node exited successfully but wrote unexpected stderr'
  }

  $stage = 'stdout-validation'
  if (-not [System.IO.File]::Exists($artifactPaths.StdoutPending)) {
    throw 'Node exited successfully without stdout.pending'
  }
  $stdoutInfo = [System.IO.FileInfo]::new($artifactPaths.StdoutPending)
  if ($stdoutInfo.Length -le 0) {
    throw 'Node exited successfully with empty stdout.pending'
  }
  if ($stdoutInfo.Length -gt $maximumAggregateStdoutBytes) {
    throw (
      "Aggregate stdout exceeds the $maximumAggregateStdoutBytes-byte cap"
    )
  }
  $stdoutBytes = [System.IO.File]::ReadAllBytes($artifactPaths.StdoutPending)
  $stdoutText = $utf8NoBom.GetString($stdoutBytes)
  $jsonDocument = $null
  try {
    $jsonDocument = [System.Text.Json.JsonDocument]::Parse($stdoutText)
    if (
      $jsonDocument.RootElement.ValueKind -ne
      [System.Text.Json.JsonValueKind]::Object
    ) {
      throw 'Aggregate stdout root must be one JSON object'
    }
    $audit = ConvertFrom-Json -InputObject $stdoutText -Depth 100
    Assert-FixedTrainingScreenAudit `
      -Audit $audit `
      -RootElement $jsonDocument.RootElement `
      -ProtocolHash $ExpectedProtocolHash
  } finally {
    if ($null -ne $jsonDocument) {
      $jsonDocument.Dispose()
    }
  }
  # A negative or ineligible result, including selected=null, is still a valid
  # terminal audit. This separate flag says whether its selection evidence was
  # produced under stable registered inputs; it is not a publication gate.
  $selectionEvidenceUsable = [bool](
    (Test-SelectionEvidenceUsable -Audit $audit) -and
    $infrastructureStable
  )
  $resultSha256 = Get-Sha256 -Bytes $stdoutBytes

  $stage = 'result-publication'
  if ([System.IO.File]::Exists($artifactPaths.Result)) {
    throw 'Refusing to replace an existing result.json'
  }
  # stdout.pending and result.json are siblings, so this is a same-volume
  # atomic rename. The complete audit becomes visible in one namespace change.
  [System.IO.File]::Move($artifactPaths.StdoutPending, $artifactPaths.Result)
  $resultPublished = $true

  $stage = 'success-publication'
  Write-AtomicJson -Path $artifactPaths.Success -Value ([ordered]@{
    schemaVersion = 1
    registrationId = $registrationId
    runId = $runId
    completedAtUtc = Get-UtcTimestamp
    nodeExitCode = $nodeExitCode
    resultPath = $artifactPaths.Result
    resultSha256 = $resultSha256
    globalClaimPath = $globalClaimPath
    nodeVersionBeforeRun = $nodeVersion
    nodeVersionAfterRun = $nodeVersionAfterRun
    expectedInfrastructureFingerprint = $ExpectedInfrastructureFingerprint
    actualInfrastructureFingerprint = $infrastructureFingerprintAfterRun
    infrastructureFingerprintBeforeProbe = `
      $infrastructureFingerprintBeforeProbe
    infrastructureFingerprintAfterProbe = `
      $infrastructureFingerprintAfterProbe
    infrastructureFingerprintAtLaunch = $infrastructureFingerprintAtLaunch
    infrastructureFingerprintAfterRun = $infrastructureFingerprintAfterRun
    sourceSha256BeforeProbe = $sourceSha256
    sourceSha256AfterProbe = $sourceSha256AfterProbe
    sourceSha256AtLaunch = $sourceSha256AtLaunch
    sourceSha256AfterRun = $sourceSha256AfterRun
    infrastructureStable = $infrastructureStable
    infrastructureAuditErrors = $infrastructureAuditErrors.ToArray()
    resultIsTerminalAudit = $true
    selectionEvidenceUsable = $selectionEvidenceUsable
    rerunAllowed = $false
  })
  exit 0
} catch {
  $failure = $_
  if ($claimCreated -and $null -ne $nodeProcess) {
    try {
      if (-not $nodeProcess.HasExited) {
        # Do not abandon a protected child merely because an audit write failed.
        # Waiting preserves at-most-once semantics; this worker never kills it.
        $nodeProcess.WaitForExit()
      }
      if ($null -eq $nodeExitCode -and $nodeProcess.HasExited) {
        $nodeExitCode = $nodeProcess.ExitCode
      }
    } catch {
      # The primary exception remains controlling. The durable claim still
      # forbids a rerun if process-state inspection also fails.
    }
  }

  if ($claimCreated -and -not $resultPublished) {
    $actualInfrastructureFingerprintForFailure = `
      $infrastructureFingerprintAfterProbe
    if ($null -ne $infrastructureFingerprintAtLaunch) {
      $actualInfrastructureFingerprintForFailure = `
        $infrastructureFingerprintAtLaunch
    }
    if ($null -ne $infrastructureFingerprintAfterRun) {
      $actualInfrastructureFingerprintForFailure = `
        $infrastructureFingerprintAfterRun
    }
    $failureAudit = [ordered]@{
      schemaVersion = 1
      registrationId = $registrationId
      runId = $runId
      failedAtUtc = Get-UtcTimestamp
      stage = $stage
      exceptionType = $failure.Exception.GetType().FullName
      message = $failure.Exception.Message
      nodeExitCode = $nodeExitCode
      stdoutPendingPath = $artifactPaths.StdoutPending
      stderrPath = $artifactPaths.Stderr
      globalClaimPath = $globalClaimPath
      localClaimPath = $artifactPaths.Claim
      expectedInfrastructureFingerprint = $ExpectedInfrastructureFingerprint
      actualInfrastructureFingerprint = `
        $actualInfrastructureFingerprintForFailure
      infrastructureFingerprintBeforeProbe = `
        $infrastructureFingerprintBeforeProbe
      infrastructureFingerprintAfterProbe = `
        $infrastructureFingerprintAfterProbe
      infrastructureFingerprintAtLaunch = $infrastructureFingerprintAtLaunch
      infrastructureFingerprintAfterRun = $infrastructureFingerprintAfterRun
      claimIsPermanent = $true
      rerunAllowed = $false
    }
    try {
      Write-AtomicJson -Path $artifactPaths.Failure -Value $failureAudit
    } catch {
      # Never replace an earlier terminal marker. launch.claim remains the
      # durable at-most-once authority even if failure publication itself fails.
    }
  }

  if (-not $claimCreated) {
    Write-Error $failure.Exception.Message
  } elseif ($resultPublished) {
    # A valid result.json was already atomically published. A missing
    # success.json is a marker-publication failure, not permission to rerun.
    Write-Error (
      'result.json is the terminal audit, but success marker publication failed: ' +
      $failure.Exception.Message
    )
  }
  exit 1
} finally {
  if ($null -ne $nodeProcess) {
    $nodeProcess.Dispose()
  }
}
