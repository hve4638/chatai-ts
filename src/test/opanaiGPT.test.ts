import { RequestForm, Models, CHAT_ROLE } from '../'
import { user, bot, system } from './message'
import { OpenAIGPTAPI } from '../models';

const openAIGPTAPI = new OpenAIGPTAPI();

describe('transform RequestForm', () => {
    const testForm:RequestForm = {
        model: Models.CLAUDE,
        model_detail: 'model-name',
        secret : {
            api_key : 'api-key',
        },
        temperature: 1.0,
        max_tokens: 512,
        top_p: 1.0,
        message : [
            system('system-message'),
            user('user-message'),
            bot('bot-message')
        ]
    };
    const [testFormUrl, testFormData, testFormConfig] = openAIGPTAPI.makeRequestData(testForm, {stream:false});

    test('valid url', async () => {
        const expected = 'https://api.openai.com/v1/chat/completions';
        expect(testFormUrl).toBe(expected);
    });
    test('valid body', async () => {
        const expected = {
            model : 'model-name',
            messages : [
                {
                    role : 'system',
                    content : 'system-message'
                },
                {
                    role : 'user',
                    content : 'user-message'
                },
                {
                    role : 'assistant',
                    content : 'bot-message'
                }
            ],
            max_tokens : 512,
            temperature : 1.0,
            top_p : 1.0,
        }
        const actual = testFormData;
        expect(actual).toEqual(expected);
    });
    test('valid header', async () => {
        const expected = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer api-key`
        }
        const actual = (testFormConfig as any).headers.headers;
        expect(actual).toEqual(expected);
    });
});