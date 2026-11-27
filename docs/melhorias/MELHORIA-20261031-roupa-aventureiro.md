# Roupa 3D do aventureiro

A roupa autoral reúne túnica, gola V, mangas articuladas, cinto, calça e botas em peças próprias vinculadas aos pivôs do personagem. As texturas são geradas em pixels e a aparência mantém a referência aprovada, sem copiar recursos externos. Os braços ficam próximos ao tronco; a geometria interna é ajustada para reduzir sobreposições durante a caminhada.

O modelo anterior segue disponível para estudos, usando `createPlayerModel(THREE, {}, { outfit: false })`. A roupa é criada e liberada com o modelo. Testes cobrem presença, articulação, texturas e descarte. A confirmação visual da caminhada e da eventual piscada na parte interna da manga ainda depende de verificação no jogo e no celular.

Prévia comparativa: `tools/roupa-aventureiro-integrada.html`.
