@echo off
SET vsPath=%~1

where msbuild.exe
IF NOT errorlevel 1 goto :do_execute
IF errorlevel 1 IF "%vsPath%" == "" echo "MSBUILD.exe not found on PATH"
IF errorlevel 1 IF "%vsPath%" == "" exit 1
IF errorlevel 1 echo "Executing %vsPath%"
IF errorlevel 1 call "%vsPath%"

where msbuild.exe
IF errorlevel 1 exit 1

@echo off
:do_execute
set RESTVAR=
shift
:loop1
if "%~1"=="" goto after_loop
set RESTVAR=%RESTVAR% %1
shift
goto loop1

:after_loop
@echo on
echo "Executing %RESTVAR%"
%RESTVAR%
