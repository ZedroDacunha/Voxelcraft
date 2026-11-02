// Validação única do projeto, usada pelo CI e no dia a dia:
//
//   npm run check
//
// 1. `node --check` em todos os módulos do jogo, ferramentas e testes;
// 2. `tools/stamp-importmap.mjs --check` para garantir que o importmap e os
//    hashes de cache no index.html batem com o conteúdo dos arquivos.
//
// Não roda os testes (isso é `npm test`): a ideia é ter um comando rápido que
// pega erro de sintaxe e esquecimento de re-carimbar antes de abrir um PR.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function filesWith(extension, directory = '.') {
    return readdirSync(path.join(ROOT, directory), { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith(extension))
        .map(entry => path.join(directory, entry.name))
        .sort();
}

// `vendor/three` fica de fora: é código de terceiros, copiado como está.
const targets = [
    ...filesWith('.js'),
    ...filesWith('.mjs', 'tools'),
    ...filesWith('.mjs', 'tests'),
];

let failures = 0;

for (const file of targets) {
    const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
    if (result.status !== 0) {
        failures++;
        const detail = (result.stderr || result.stdout || '').trim();
        console.error(`✗ sintaxe: ${file}\n${detail.split('\n').slice(0, 6).join('\n')}`);
    }
}
console.log(`sintaxe: ${targets.length - failures}/${targets.length} arquivos ok`);

const stamp = spawnSync(process.execPath, [path.join(ROOT, 'tools/stamp-importmap.mjs'), '--check'], { encoding: 'utf8' });
if (stamp.status !== 0) {
    failures++;
    console.error(`✗ importmap: ${(stamp.stderr || stamp.stdout || '').trim()}`);
    console.error('  rode `npm run stamp` para regravar os hashes no index.html');
} else {
    console.log(`importmap: ${(stamp.stdout || '').trim() || 'em dia'}`);
}

if (failures > 0) {
    console.error(`\n${failures} verificação(ões) falharam.`);
    process.exit(1);
}
console.log('\ntudo em dia.');
