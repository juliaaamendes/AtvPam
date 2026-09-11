# Campo · Registro de visitas técnicas

Aplicativo mobile para registrar visitas agrícolas com foto, GPS e validação de estabilidade. Trabalho **The Code Challenge — Hardware & Recursos Nativos**, níveis **Pleno + Júnior**.

## Executar

Requisitos: Node.js **22.13 ou superior** e npm. Projeto em Expo SDK 57, React Native e TypeScript. Instale no aparelho uma versão do Expo Go compatível com o SDK 57, consultando [Expo Go](https://expo.dev/go). Android ou iPhone físico é recomendado para validar os sensores.

```bash
git clone https://github.com/juliaaamendes/AtvPam.git
cd AtvPam
npm ci
npm start
```

No Windows, se o PowerShell bloquear `npm.ps1`, use `npm.cmd ci` e `npm.cmd start`. Escaneie o QR code com o Expo Go (Android) ou Câmera (iPhone), com computador e aparelho na mesma rede. Para emulador Android já aberto, use `npm run android`. O simulador iOS exige macOS e não substitui um aparelho físico para o acelerômetro.

`npm run web` permite visualizar o layout e preencher o formulário. **Câmera e conclusão com sensor são destinadas ao aplicativo nativo**; o navegador informa essa limitação. Não há dados ou sensores simulados no fluxo de produção.

```bash
npm run typecheck
npm test
npx expo-doctor
```

Para verificar a prévia web automaticamente (requer Microsoft Edge instalado):

```bash
npx expo export --platform web
npm run test:ui
```

Os testes de interface verificam navegação, preservação do formulário entre abas e ausência de transbordamento horizontal nas resoluções 360×800, 844×390 e 1280×800. Não simulam aprovação do sensor nem substituem validação nativa.

## Fluxo

1. Toque em **Nova visita**. Preencha propriedade e responsável técnico, os dois campos obrigatórios.
2. Informe cultura, condição da lavoura e observações.
3. Use **Fotografar** e **Capturar GPS**. A precisão capturada aparece com cor e texto.
4. Toque em **Concluir e salvar visita** e mantenha o aparelho estável durante os três segundos de leitura.
5. Abra o histórico e toque no registro para consultar todos os dados e a foto.

Se câmera ou GPS estiverem indisponíveis, o app explica o problema e permite continuar sem essa evidência, mediante confirmação explícita. Sem acelerômetro funcional, a conclusão permanece bloqueada; formulário e histórico continuam acessíveis. Campos do formulário permanecem ao trocar de aba, mas rascunhos não são persistidos ao encerrar o aplicativo.

## Atendimento à atividade

| Requisito | Solução                                                                                                                                                                                                   | Código                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Júnior    | Verifica `granted` e `canAskAgain` antes e depois de pedir a câmera; bloqueio permanente mostra instruções por sistema e botão com `Linking.openSettings()`, incluindo alternativa caso a abertura falhe. | `src/hardware.ts`                              |
| Pleno     | `Accelerometer`, leitura a cada 50 ms, magnitude `Math.hypot(x, y, z)` e bloqueio acima de 2,0g.                                                                                                          | `src/hardware.ts`, `src/domain.ts`             |
| RF01      | Metadados no AsyncStorage e cópia da foto para a pasta de documentos, fora do cache da câmera. Detalhes acessíveis sem internet.                                                                          | `src/storage.ts`                               |
| RF02      | Verde abaixo de 10 m, amarelo de 10 a 30 m inclusive, vermelho acima de 30 m. Precisão desconhecida é cinza.                                                                                              | `src/domain.ts`, `GPSBadge` em `App.tsx`       |
| RNF01     | Tratamento de permissão, GPS desligado, câmera ausente/ocupada, timeout, sensor ausente/sem leituras e erro de persistência.                                                                              | `src/hardware.ts`, `src/storage.ts`, `App.tsx` |
| RNF02     | Safe areas, rolagem, teclado, botões com texto flexível, largura máxima e colunas a partir de 760 px. Orientação livre.                                                                                   | `App.tsx`, `app.json`                          |

O nível Sênior não faz parte do escopo escolhido. O histórico usa uma FlatList virtualizada; não há recurso de contatos.

## Entenda a trava

O [acelerômetro do Expo](https://docs.expo.dev/versions/latest/sdk/accelerometer/) informa os três eixos em **g**. A magnitude é `√(x² + y² + z²)`; em repouso tende a aproximadamente 1g, pois inclui gravidade. Não é necessário multiplicar ou dividir por 9,81.

Cada tentativa inicia uma janela de três segundos. Um pico **estritamente maior que 2,0g** interrompe a tentativa com o título exato **“Instabilidade Física Detectada”**. O pico é guardado fora do estado visual do React. Assim, leituras estáveis posteriores não apagam uma instabilidade já detectada.

A janela exige pelo menos 20 amostras, nenhuma lacuna acima de 600 ms e uma amostra recente ao terminar. Leituras inválidas, ausência de sensor ou saída do aplicativo durante a janela impedem a conclusão. O listener, os timers e a observação do estado do aplicativo são removidos ao finalizar, falhar ou cancelar. O sensor só fica ativo durante a verificação; a gravação local ocorre imediatamente após sua aprovação.

Essa é a regra de aceleração pedida na atividade, **não um detector completo de quedas**: queda livre pode apresentar magnitude próxima de 0g e impactos entre amostras podem não ser observados. Não jogue nem deixe cair o aparelho para testar.

## Persistência e permissões

Os registros concluídos são salvos sob a chave `@campo/visits/v1`, sem backend. Só há mensagem de sucesso depois de `AsyncStorage.setItem` resolver. A foto é copiada com a API [`File`/`Directory` do Expo](https://docs.expo.dev/versions/latest/sdk/filesystem/) antes da gravação dos metadados; falhas tentam remover a cópia sem registro. O histórico é validado antes de qualquer sobrescrita. Dados inválidos provocam erro visível e não são apagados silenciosamente.

A [resposta de permissão do ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) informa quando o sistema não pode perguntar novamente. No Expo Go, configure a permissão **do Expo Go**; em uma compilação própria, configure **Campo**. As mensagens dos plugins em `app.json` são aplicadas em uma compilação nativa própria. O app solicita câmera, localização durante uso e sensores; não precisa de microfone nem acesso à galeria.

O [serviço de localização](https://docs.expo.dev/versions/latest/sdk/location/) é verificado antes da captura, com limite de espera de 15 segundos. O timeout descarta a resposta tardia na interface; a API de captura única não oferece cancelamento da solicitação nativa. A posição não é acompanhada em segundo plano.

Desinstalar o aplicativo ou limpar seus dados remove o histórico. Não há sincronização, exportação ou criptografia adicional. O AsyncStorage carrega o histórico completo em memória e atende ao escopo da atividade; volumes grandes de auditorias exigiriam SQLite com consultas paginadas.

## Validação e entrega

Os testes automatizados cobrem limites do GPS, cálculo vetorial, pico transitório, limite exato de 2,0g, falta de leituras, lacunas, dados inválidos e serialização do histórico. Eles não substituem testes de permissões, câmera e sensores reais. Veja o [checklist manual](docs/VALIDACAO.md) e o [roteiro de vídeo de até 3 minutos](docs/ROTEIRO_VIDEO.md).

Antes da entrega, execute o checklist em um dispositivo, grave o vídeo e publique os arquivos no repositório. A pasta `.npm-cache`, `node_modules` e exportações não devem ser versionadas.

- Repositório configurado: https://github.com/juliaaamendes/AtvPam
- Vídeo: **adicionar o link após gravar e publicar**.

O código deve ser estudado e explicado por quem apresenta. A implementação foi preparada com apoio de IA; confirme pessoalmente os resultados no aparelho e explique as decisões, especialmente a fórmula, o limite e o fluxo de permissão.
