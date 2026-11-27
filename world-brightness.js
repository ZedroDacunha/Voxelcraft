// Brilho do mundo, como gama no próprio shader.
//
// O three r160 expõe um ponto de extensão pronto para isso: o corpo
// `CustomToneMapping` do chunk `tonemapping_pars_fragment` é um stub vazio, e
// o renderer o chama em todo material quando `toneMapping = CustomToneMapping`.
// Trocamos o corpo por uma gama:
//
//     saída = pow(entrada, 1 / brilho)
//
// O expoente viaja no uniform `toneMappingExposure`, que o renderer **já**
// manda a todos os materiais a cada troca de material — não há uniform novo,
// nem passe de render extra, nem pós-processamento: é um `pow` dentro do
// fragment shader que já rodaria. Com brilho 100% o expoente é 1 e
// `pow(x, 1)` devolve x — o jogo nasce pixel a pixel igual ao de sempre.
//
// A gama é o que o jogador espera de "brilho": escuros sobem (uma caverna a
// 0,02 linear vira 0,14 com 200%) e altas luzes quase não se mexem (0,9 vira
// 0,94) — num ganho linear tudo escala junto e o sol estouraria primeiro.

/**
 * Brilho em porcentagem (0,5 = 50% … 2 = 200%) → o expoente de gama que o
 * shader aplica. 100% → 1 (identidade); mais brilho, expoente menor.
 */
export function gammaForBrightness(brightness) {
    return 1 / brightness;
}

// O texto exato do stub no three r160. Se uma atualização do three mudar o
// chunk, `installBrightnessToneMapping` devolve false e os testes cobram —
// silenciosamente o brilho voltaria a não fazer nada, e isso não pode passar.
const STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
const GAMMA = 'vec3 CustomToneMapping( vec3 color ) { return pow( max( color, vec3( 0.0 ) ), vec3( 1.0 / max( toneMappingExposure, 0.1 ) ) ); }';

/**
 * Instala a gama no ShaderChunk do three. Chamar uma vez, antes do primeiro
 * material do mundo compilar. Devolve `true` quando o stub foi trocado e
 * `false` se o stub já não está lá (ou seja: three mudou, ou já está instalado).
 */
export function installBrightnessToneMapping(shaderChunk) {
    const source = shaderChunk?.tonemapping_pars_fragment;
    if (typeof source !== 'string' || !source.includes(STUB)) return false;
    shaderChunk.tonemapping_pars_fragment = source.replace(STUB, GAMMA);
    return true;
}
