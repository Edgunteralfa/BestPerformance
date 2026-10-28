param(
  [string[]]$Models = @('qwen3.5:4b','qwen3:4b-instruct','qwen3:1.7b')
)
$ErrorActionPreference = 'Stop'
$source = @'
B25 Plus is an implemented Industrial AI system with protected and registered software IP, an isolated pre-pilot runtime, validated engineering tests and readiness for controlled validation. The system addresses governed cross-company execution, human approvals, information provenance and confidence categories. No measured industrial pilot outcomes have been reported yet. Do not infer granted patents, concluded contracts, actual deployment results or unverified TAM.
'@
$question = 'What has B25 Plus actually validated, and how will you demonstrate industrial impact in a controlled pilot?'
foreach ($model in $Models) {
  $payload = @{
    model = $model; stream = $false; think = $false; keep_alive = '12m'
    options = @{ temperature = 0.2; num_ctx = 4096; num_predict = 230 }
    messages = @(
      @{ role = 'system'; content = 'Write a factual English reply to a competition judge, around 80-110 words. Use only supplied facts. Do not invent metrics, signed deals, patents granted, pilot outcomes, commercial results or disclosed technical mechanisms. Explain limitations.' },
      @{ role = 'user'; content = "Known evidence: $source`nQuestion: $question" }
    )
  } | ConvertTo-Json -Depth 9
  $timer = [Diagnostics.Stopwatch]::StartNew()
  try {
    $answer = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/chat' -Method Post -ContentType 'application/json' -Body $payload -TimeoutSec 130
    $timer.Stop()
    $speed = if ($answer.eval_duration) { [math]::Round($answer.eval_count/($answer.eval_duration/1e9),1) } else { 0 }
    $msg = $answer.message.content
    [pscustomobject]@{
      model=$model; total_s=[math]::Round($timer.Elapsed.TotalSeconds,2)
      load_s=[math]::Round($answer.load_duration/1e9,2)
      decode_s=[math]::Round($answer.eval_duration/1e9,2)
      tokens=$answer.eval_count; tokens_per_s=$speed
      words=($msg -split '\s+').Count; thinking_chars=([string]$answer.message.thinking).Length
      answer=$msg
    } | ConvertTo-Json -Compress -Depth 5
  } catch {
    Write-Output (('ERROR '+$model+' '+$_.Exception.Message))
  }
}
Write-Output '--- RESIDENTS ---'
ollama ps
