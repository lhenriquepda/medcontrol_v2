# context/qa-reports/

Relatórios de validação QA por release. Distinto de `context/Validar.md` (checklist de items pendentes pra validar) — este é o **registro de execução** das validações que rodaram em emulator + Appium + Supabase MCP.

## Convenção de nome

```
YYYY-MM-DD-vX.Y.Z.W-{escopo}.md
```

- `YYYY-MM-DD` — data de execução da validação
- `vX.Y.Z.W` — versão do release sendo validada
- `{escopo}` — tipo de validação (escolher curto):
  - `appium` — testes via Appium + UiAutomator2 (Regra 17)
  - `emulator` — testes manuais em emulator sem Appium (raro)
  - `fixes-validation` — validação focada em fixes específicos numa release de patches
  - `final-validation` — relatório consolidado pré-AAB de uma release
  - `device` — validação manual em device físico

## Conteúdo esperado

Cada relatório deve ter:

1. **Cabeçalho** com versão, build status, edge deploy versions, emulator name
2. **Setup** — usuários teste, patients, push subscriptions, qualquer state DB relevante
3. **Cada cenário** com:
   - Sequência cronológica (timestamps UTC)
   - Logs relevantes em bloco código
   - Screenshot path em `C:/temp/` se aplicável
   - Resultado: PASSOU / FALHOU / DIFERIDO / CODE-REVIEWED
4. **Conclusão** com tabela resumo + decisão de ship

## Quando criar

Criar **durante o Passo 11** (validação) do WORKFLOW. Distinto de `Validar.md`:
- `Validar.md` (raiz `context/`) = checklist concise de o que falta validar (`[ ]` items)
- `qa-reports/{data}-vX.Y.Z.W-appium.md` = registro detalhado do que foi validado autonomamente

Quando QA descobre problemas durante validação:
- Items que requerem fix → entry em `BUGS.md` ou comentário num item de `CHECKLIST.md`
- Items que só precisam de validação manual device → entry em `Validar.md`
- Items completados autonomously → registrados aqui no qa-report
