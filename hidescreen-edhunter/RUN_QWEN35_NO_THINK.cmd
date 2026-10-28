@echo off
chcp 65001 >nul
title Qwen 3.5 B25 Fast - No Thinking
ollama run qwen3.5:4b --think=false --keepalive 30m
