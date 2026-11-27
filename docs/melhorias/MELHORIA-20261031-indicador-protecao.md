# Barra e proteção de armadura

Ícone autoral B aprovado, em três estados pixelados (inteiro, meio e vazio). A barra aparece acima da vida quando há proteção equipada; a leitura acessível informa pontos de 0 a 20. Cada ícone inteiro representa dois pontos. A armadura de cobre tem 2/4/3/1 pontos (capacete/peitoral/calça/botas), 10 pontos no conjunto.

Dano direto é reduzido pela fórmula Java de armadura sem dureza nem encantamentos: pontos efetivos = min(20, max(pontos/5, pontos - dano/2)); dano final = dano × (1 - pontos efetivos/25). Quedas, fome, afogamento e `/kill` ignoram proteção e desgaste, conforme a regra já existente. A peça que quebra ainda protege no golpe em que quebrou. Durabilidade usa o dano original, antes da redução. Sem mobs hostis atualmente; não afirmar teste real de combate sem validação.

A vida agora pode ser fracionária; o save conserva valores positivos menores que 1 e a HUD não exibe zero enquanto o jogador estiver vivo.

Referências de fórmula: https://www.minecraftmaps.com/tools/armor-protection-calculator e https://minecraft.wiki/w/Durability. Verificações manuais pendentes: barra com nenhuma peça, cada peça, trocar e quebrar, recarregar save, morte, combate futuro e posicionamento no celular.
