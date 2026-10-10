import test from 'node:test';
import assert from 'node:assert/strict';
import {playerDetailRows} from '../.test-dist/app/player-roster.js';

test('private player facts require an existing grant and a supplied value; real zero stays zero',()=>{
  const player={uuid:'00000000-0000-0000-0000-000000000001',name:'Operator',food:0,position:{x:0,y:64,z:0},address:'192.0.2.1'};
  const labels=scopes=>new Map(playerDetailRows(player,scopes));
  assert.equal(labels([]).has('Position'),false);
  assert.equal(labels([]).has('IP address'),false);
  assert.deepEqual(labels(['players.location']).get('Position'),JSON.stringify(player.position));
  assert.equal(labels(['players.location']).has('IP address'),false);
  assert.equal(labels(['players.address']).get('IP address'),'192.0.2.1');
  assert.equal(labels([]).get('Food'),0);
  assert.equal(new Map(playerDetailRows({uuid:player.uuid,name:player.name},['players.location','players.address'])).has('Position'),false);
});
