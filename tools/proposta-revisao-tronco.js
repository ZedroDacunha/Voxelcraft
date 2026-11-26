// Revisão visual: escolhas aplicadas ao lado da textura anterior.
import { TRUNK_TOP_EXAMPLES } from './proposta-topo-tronco.js';
import { createPreviousTrunkTextures } from './proposta-detalhes-tronco.js';

export const TREE_TRUNK_REVIEW = [
    {
        ...TRUNK_TOP_EXAMPLES[3], id: 'escolhido', badge: 'Implementado · Tronco refinado',
        tag: 'Fibras delicadas · Castanho natural · Veios discretos', title: 'Tronco implementado', recommended: true,
        description: 'Casca com fibras delicadas e tom natural, junto do topo com veios discretos.',
    },
    {
        ...createPreviousTrunkTextures(), id: 'anterior', badge: 'Referência · Anterior',
        tag: 'Antes do refinamento', title: 'Tronco anterior', recommended: false,
        description: 'Casca e topo anteriores, na mesma iluminação para comparação.',
    },
];
