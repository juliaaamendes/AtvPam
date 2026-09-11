# Roteiro para vídeo · até 3 minutos

Prepare uma visita real de demonstração, confira as permissões e deixe o código aberto nos pontos citados. Grave tela e áudio. Evite mostrar nomes, fotos ou coordenadas particulares de terceiros.

| Tempo     | Mostrar                       | Explicar com suas palavras                                                                                                                                                         |
| --------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 | Início e nova visita          | “Este é o Campo, um registro de visitas agrícolas. Escolhi os desafios Pleno e Júnior.”                                                                                            |
| 0:15–0:45 | Dados, foto e GPS             | Preencha propriedade e técnico; fotografe e capture a localização. Explique verde <10 m, amarelo 10–30 m e vermelho >30 m.                                                         |
| 0:45–1:10 | Permissão de câmera bloqueada | Mostre o alerta e o acesso às configurações. Aponte o teste de `canAskAgain` em `src/hardware.ts`.                                                                                 |
| 1:10–1:45 | Trava e nova tentativa        | Demonstre um bloqueio acima de 2g, com segurança ou sensor do emulador. Depois conclua com aparelho estável. Explique `Math.hypot(x,y,z)`, janela de 3 segundos e memória do pico. |
| 1:45–2:10 | Histórico e detalhes          | Abra o registro e a foto. Demonstre consulta offline. Explique AsyncStorage para dados e pasta de documentos para a imagem.                                                        |
| 2:10–2:35 | GPS desligado e rotação       | Mostre uma mensagem amigável e a adaptação das colunas/rolagem ao girar o aparelho.                                                                                                |
| 2:35–2:55 | Arquivos e testes             | Mostre `src/domain.ts`, `src/storage.ts` e o resultado de `npm test`. Explique remoção de listeners e bloqueio se faltarem leituras.                                               |

Não apresente um teste automatizado como se fosse uma leitura física. Se algum recurso não puder ser demonstrado no aparelho usado, informe a limitação. Antes de enviar, confirme que o vídeo tem no máximo 3 minutos e que os links do GitHub e do vídeo abrem para o professor.
