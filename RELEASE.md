# 🚀 Guia de Release Automatizado

Este projeto usa GitHub Actions para automatizar a publicação no NPM sempre que uma nova tag for criada.

## 📋 Pré-requisitos

### 1. Configurar NPM Token no GitHub

1. Acesse [npmjs.com](https://www.npmjs.com) e faça login
2. Vá em **Account Settings** → **Access Tokens**
3. Clique em **Generate New Token** → **Automation**
4. Copie o token gerado
5. No GitHub, vá em **Settings** → **Secrets and variables** → **Actions**
6. Clique em **New repository secret**
7. Nome: `NPM_TOKEN`
8. Valor: Cole o token do NPM

### 2. Verificar Permissões

Certifique-se de que você tem permissões para:
- Fazer push no repositório
- Criar tags
- Executar workflows

## 🔄 Como Criar um Release

### Método 1: Script Automatizado (Recomendado)

```bash
# Correção de bug (1.0.0 → 1.0.1)
./scripts/release.sh patch "Correção de bug no trace duplicado"

# Nova funcionalidade (1.0.0 → 1.1.0)
./scripts/release.sh minor "Adicionar suporte ao Express"

# Breaking change (1.0.0 → 2.0.0)
./scripts/release.sh major "Refatoração completa da API"
```

### Método 2: Manual

```bash
# 1. Atualizar versão
npm version patch  # ou minor, major

# 2. Fazer push da tag
git push origin main --tags
```

## 🎯 O que Acontece Automaticamente

Quando você cria uma tag, o GitHub Actions:

1. ✅ **Executa testes** - Garante que tudo está funcionando
2. ✅ **Faz build** - Compila o TypeScript
3. ✅ **Publica no NPM** - Disponibiliza a nova versão
4. ✅ **Cria GitHub Release** - Documenta as mudanças

## 📊 Monitoramento

### Verificar Status do Workflow
- Acesse: `https://github.com/SEU_USUARIO/sdk-logger/actions`
- Procure pela execução mais recente

### Verificar Publicação no NPM
```bash
# Verificar se a versão foi publicada
npm view @psouza.yuri/sdk-logger versions --json

# Instalar a versão mais recente
npm install @psouza.yuri/sdk-logger@latest
```

## 🐛 Troubleshooting

### Erro: "NPM_TOKEN not found"
- Verifique se o secret `NPM_TOKEN` está configurado no GitHub
- Certifique-se de que o token tem permissões de publicação

### Erro: "Package already exists"
- A versão já foi publicada
- Use `npm version` para criar uma nova versão

### Erro: "Tests failed"
- Corrija os testes antes de criar o release
- Execute `npm test` localmente primeiro

## 📝 Convenções de Versionamento

Seguimos [Semantic Versioning](https://semver.org/):

- **PATCH** (1.0.0 → 1.0.1): Correções de bugs
- **MINOR** (1.0.0 → 1.1.0): Novas funcionalidades (compatível)
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes

## 🔧 Configuração Avançada

### Workflows Personalizados

Os workflows estão em `.github/workflows/`:
- `ci.yml` - Validação de PRs e commits
- `publish-npm.yml` - Publicação automática

### Customizar Release Notes

Edite o template em `.github/workflows/publish-npm.yml` na seção `Create GitHub Release`.

## 📚 Links Úteis

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)



