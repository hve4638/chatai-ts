import { ChatRole, type RequestForm } from '../../types/request-form'
import { ChatAIResponse } from '../../types/response-data';

import { CLAUDE_URL, ROLE, ROLE_DEFAULT } from './data'

import { assertNotNull, AsyncQueue, bracketFormat } from '../../utils'

import ChatAIAPI from '../ChatAIAPI'

type ClaudeSystemPrompt = {
    type : 'text';
    text : string;
}[];

type ClaudeMessage = {
    role: ROLE;
    content: {
        type: 'text';
        text: string;
    }[];
}[];

class ClaudeAPI extends ChatAIAPI {
    makeRequestData(form:RequestForm): [string, object, object] {
        assertNotNull(form.secret?.api_key, 'api_key is required');

        let systemPrompt = '';
        const messages:ClaudeMessage = [];
        for (const message of form.message) {
            const role = ROLE[message.role];
            const text = message.content[0].text!;
            
            if (role === ROLE.SYSTEM) {
                if (messages.length === 0) {
                    systemPrompt += text;
                }
                else {
                    messages.push({
                        role: ROLE[ChatRole.BOT],
                        content: [
                            {
                                type: 'text',
                                text: 'system: ' + text,
                            }
                        ]
                    });
                }
            }
            else {
                messages.push({
                    role: role,
                    content: [
                        {
                            type: 'text',
                            text: text,
                        }
                    ]
                });
            }
        }

        const url = CLAUDE_URL;
        const body = {
            model : form.model_detail,
            messages : messages,
            system : systemPrompt,
            max_tokens: form.max_tokens ?? 1024,
            temperature: form.temperature ?? 1.0,
            top_p : form.top_p ?? 1.0,
        };
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': form.secret.api_key,
            'anthropic-version': '2023-06-01'
        };
        return [url, body, {headers}];
    }
    handleResponse(rawResponse: any) {
        let tokens: number;
        let warning: string | null;
        try {
            tokens = rawResponse.usage.output_tokens;
        }
        catch (e) {
            tokens = 0;
        }
        
        const reason = rawResponse.stop_reason;
        const text = rawResponse.content[0]?.text ?? '';

        if (reason == 'end_turn') warning = null;
        else if (reason == 'max_tokens') warning = 'max token limit';
        else warning = `unhandle reason : ${reason}`;
      
        return {
            raw : rawResponse,

            content: [text],
            warning : warning,

            tokens : tokens,
            finish_reason : reason,
        }
    }
    
    async handleStreamChunk(chunkOutputQueue:AsyncQueue, messageInputQueue:AsyncQueue):Promise<Omit<ChatAIResponse['response'],'ok'|'http_status'|'http_status_text'>> {
        throw new Error('Not implemented.');
    }
}

export default ClaudeAPI;