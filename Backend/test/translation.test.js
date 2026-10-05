const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sourceHash, cachedUrdu, studentQuestion, translateQuestion, TranslationError } = require('../services/translation');
const question = { _id:'fixture', grade:4, text:'Which device is used for typing?', correct:'A', imageUrl:'https://example.invalid/image',
    options:[{id:'A',text:'Keyboard'},{id:'B',text:'Monitor'},{id:'C',text:'Speaker'}] };
const translated = {text:'ٹائپ کرنے کے لیے کون سا آلہ استعمال ہوتا ہے؟',
    options:[{id:'A',text:'کی بورڈ'},{id:'B',text:'مانیٹر'},{id:'C',text:'اسپیکر'}]};
const response = value => ({ok:true,json:async () => ({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})});

test('translation request sends question and options only, validates output, and keeps key in backend headers', async () => {
    process.env.GEMINI_API_KEY = 'test-only-key';
    try {
        const urdu = await translateQuestion(question,{fetchImpl:async (url,options) => {
            assert.ok(!url.includes('test-only-key'));
            assert.equal(options.headers['x-goog-api-key'],'test-only-key');
            const body = JSON.parse(options.body);
            const content = JSON.parse(body.contents[0].parts[0].text);
            assert.equal(content.correct,undefined); assert.equal(content.imageUrl,undefined);
            assert.equal(content.options.length,3); assert.ok(body.systemInstruction.parts[0].text.includes('Do not expand abbreviations'));
            assert.ok(body.systemInstruction.parts[0].text.includes('NEVER Roman Urdu'));
            return response(translated);
        }});
        assert.equal(urdu.sourceHash,sourceHash(question));
        assert.deepEqual(urdu.options,translated.options);
    } finally { delete process.env.GEMINI_API_KEY; }
});

test('missing key avoids calls; quota, unsafe option mapping and incomplete responses are rejected', async () => {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(translateQuestion(question,{fetchImpl:() => assert.fail('No call without key')}), {code:'not_configured'});
    process.env.GEMINI_API_KEY = 'test-only-key';
    try {
        await assert.rejects(translateQuestion(question,{fetchImpl:async () => ({ok:false,status:429})}),{code:'quota_exceeded'});
        await assert.rejects(translateQuestion(question,{fetchImpl:async () => ({ok:false,status:404})}),{code:'invalid_model'});
        await assert.rejects(translateQuestion(question,{fetchImpl:async () => ({ok:false,status:400})}),{code:'invalid_configuration'});
        for (const value of [{...translated, options:[...translated.options].reverse()},
            {...translated,options:translated.options.slice(1)}, {...translated,text:question.text},
            {...translated,options:translated.options.map(o => ({...o,text:'کی بورڈ'}))},
            {...translated,text:'کم্পিউটার کیا ہے؟'}]) {
            await assert.rejects(translateQuestion(question,{fetchImpl:async () => response(value)}),{code:'invalid_response'});
        }
        await assert.rejects(translateQuestion(question,{fetchImpl:async () => ({ok:true,json:async () => ({candidates:[{finishReason:'MAX_TOKENS'}]})})}),{code:'invalid_response'});
    } finally { delete process.env.GEMINI_API_KEY; }
});

test('cached Urdu is shared, invalidated on source changes and never contains the answer key', () => {
    const saved = {...question,urdu:{...translated,sourceHash:sourceHash(question)}};
    assert.deepEqual(cachedUrdu(saved),translated);
    assert.equal(cachedUrdu({...saved,text:'Edited question'}),null);
    assert.equal(cachedUrdu({...saved,grade:7}),null);
    assert.equal(cachedUrdu({...saved,options:[...saved.options].reverse()}),null);
    assert.ok(cachedUrdu({...saved,correct:'B',imageUrl:null}));
    const view = studentQuestion(saved);
    assert.equal(view.correct,undefined); assert.equal(view.urdu.sourceHash,undefined);
    assert.equal(view.urdu.model,undefined); assert.equal(view.options[0]._id,undefined);
    assert.ok(!JSON.stringify(view).includes('test-only-key'));
});
