import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Pages respeita a fonte configurada e tenta novamente um deploy com falha', () => {
    const workflow=readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url),'utf8');
    assert.match(workflow,/gh api .*pages.*--jq '\.build_type'/);
    assert.match(workflow,/legacy\|workflow\)/);
    assert.match(workflow,/if: needs\.fonte\.outputs\.tipo == 'workflow'/);
    assert.match(workflow,/actions\/upload-pages-artifact@v3/);
    assert.match(workflow,/id: deploy\s+continue-on-error: true/);
    assert.match(workflow,/if: steps\.deploy\.outcome == 'failure'[\s\S]*id: deploy_retry[\s\S]*actions\/deploy-pages@v4/);
});
