import {createOxfordHandler} from './core.js';
Deno.serve(createOxfordHandler({env:name=>Deno.env.get(name)}));
