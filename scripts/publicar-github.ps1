param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Mensagem,

    [switch]$SemValidacao
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

if (-not $SemValidacao) {
    Write-Host "Validando a aplicação antes da publicação..." -ForegroundColor Cyan
    docker compose build backend
    if ($LASTEXITCODE -ne 0) {
        throw "A validação falhou. Nenhuma atualização foi enviada ao GitHub."
    }
}

$Remote = git remote get-url origin 2>$null
if (-not $Remote -or $Remote -match "fastapi/full-stack-fastapi-template") {
    throw "Configure primeiro o repositório GitHub próprio da Sealab como origin."
}

git add --all
if ($LASTEXITCODE -ne 0) { throw "Não foi possível preparar os arquivos." }

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Não há alterações novas para publicar." -ForegroundColor Yellow
    exit 0
}

git commit -m $Mensagem
if ($LASTEXITCODE -ne 0) { throw "Não foi possível registrar a atualização." }

$Branch = git branch --show-current
git push --set-upstream origin $Branch
if ($LASTEXITCODE -ne 0) { throw "A atualização foi registrada localmente, mas o envio ao GitHub falhou." }

Write-Host "Atualização publicada no GitHub com sucesso." -ForegroundColor Green
