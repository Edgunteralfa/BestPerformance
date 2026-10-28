@echo off
chcp 65001 >nul
title B25 Local Qwen - Thinking OFF
echo ============================================
echo  B25 Plus - Local Ollama QA, Thinking OFF
echo ============================================
echo  [1] Qwen3.5 4B - quality / full answers
echo  [2] Qwen3 1.7B - fast backup
echo.
choice /C 12 /N /M "Choose model [1/2]: "
if errorlevel 2 (
  echo Using qwen3:1.7b, thinking=false, context 4096.
  ollama run qwen3:1.7b --think=false --keepalive 30m
) else (
  echo Using qwen3.5:4b, thinking=false, context 4096.
  ollama run qwen3.5:4b --think=false --keepalive 30m
)
