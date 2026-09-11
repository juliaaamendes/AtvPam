# Checklist de validação em aparelho

## Verificações automáticas executadas

- TypeScript: sem erros (`npm run typecheck`).
- Lógica de domínio: 19 testes aprovados (`npm test`).
- Interface web no Edge: 4 testes aprovados (`npm run test:ui`), incluindo navegação em três resoluções e mensagens de indisponibilidade de recursos nativos.
- Expo Doctor: 21 de 21 verificações aprovadas.
- Exportação dos bundles Android, iOS e web concluída (`npx expo export --platform all --max-workers 2`). Isso valida o empacotamento JavaScript; não representa compilação de APK/IPA nem execução dos sensores.
- Formatação: `npm run format:check` aprovado.

## Validação nativa pendente

Preencha os resultados reais antes de apresentar. Os itens abaixo são testes propostos, não resultados já obtidos.

| Caso                        | Procedimento                                                                                                          | Resultado esperado                                                           | Resultado real |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------- |
| Fluxo completo              | Preencher, fotografar, capturar GPS e concluir com aparelho apoiado                                                   | Visita aparece com foto e coordenadas no histórico                           | Pendente       |
| Persistência                | Concluir, fechar totalmente o app e reabrir em modo avião                                                             | Registro e foto continuam acessíveis                                         | Pendente       |
| Câmera negada               | Negar a solicitação inicial                                                                                           | Mensagem amigável; formulário preservado                                     | Pendente       |
| Câmera bloqueada            | Negar permanentemente pelas opções disponíveis no Android ou ajustar permissões no sistema                            | Instruções claras e botão Abrir configurações                                | Pendente       |
| Permissão recuperada        | Permitir câmera nas configurações e voltar; tocar Fotografar                                                          | Nova consulta da permissão permite a câmera                                  | Pendente       |
| Cancelar câmera             | Abrir a câmera e cancelar                                                                                             | Nenhuma falha; foto anterior preservada                                      | Pendente       |
| Câmera ausente              | Executar em emulador sem câmera disponível                                                                            | Mensagem de indisponibilidade                                                | Pendente       |
| GPS desligado               | Desativar localização e tocar Capturar GPS                                                                            | Solicita ativação do GPS; mantém formulário                                  | Pendente       |
| GPS negado                  | Negar localização; repetir até bloqueio permanente quando suportado                                                   | Orientações adequadas ao estado                                              | Pendente       |
| GPS sem resposta            | Testar em ambiente sem sinal                                                                                          | Espera limitada e mensagem para tentar em local aberto                       | Pendente       |
| Sem evidências              | Concluir sem foto/GPS e confirmar                                                                                     | Registro explícito sem essas evidências                                      | Pendente       |
| Instabilidade               | Durante os 3 segundos, mover com firmeza o aparelho segurando com segurança; preferir controles de sensor do emulador | Se leitura superar 2,0g: “Instabilidade Física Detectada”, sem novo registro | Pendente       |
| Nova tentativa              | Após bloqueio, apoiar aparelho e concluir novamente                                                                   | Nova janela estável autoriza uma única visita                                | Pendente       |
| Sensor ausente              | Executar onde o acelerômetro não está disponível                                                                      | Bloqueio explicado; histórico continua acessível                             | Pendente       |
| Interrupção                 | Trocar de aplicativo durante a janela de leitura                                                                      | Cancela conclusão e permite tentar novamente                                 | Pendente       |
| Toque repetido              | Tocar rapidamente várias vezes em concluir                                                                            | Apenas uma operação e um registro                                            | Pendente       |
| Erro de armazenamento       | Testar com armazenamento indisponível/cheio em ambiente controlado                                                    | Sem falso sucesso; formulário mantido                                        | Pendente       |
| Rotação                     | Girar aparelho em início, formulário, histórico e detalhes                                                            | Cards e botões legíveis, rolagem disponível                                  | Pendente       |
| Tela pequena e fonte grande | Testar largura de 320–360 px e fonte ampliada                                                                         | Conteúdo acessível sem sobreposição de controles                             | Pendente       |

As faixas exatas de precisão (9,99/10/30/30,01 m) são validadas automaticamente: a precisão real do GPS não pode ser escolhida pelo aplicativo. O critério >2,0g também é testado sem depender de movimentos físicos.

Para testar offline com Expo Go, carregue primeiro o bundle com conexão e mantenha o servidor de desenvolvimento disponível quando necessário. Uma compilação própria com o JavaScript embutido é a forma adequada de testar partida totalmente offline; o acesso aos dados locais não exige servidor.
