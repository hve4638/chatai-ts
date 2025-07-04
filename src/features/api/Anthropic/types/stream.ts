export type ClaudeStreamDataMessageStart = {
    type: 'message_start';
    message: {
        id: string;
        type: string;
        role: 'user' | 'assistant';
        model: string;
        stop_reason: null;
        stop_sequence: null;
        usage: {
            input_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
            output_tokens?: number;
        },
        content: never[];
    },

}

export type ClaudeStreamDataContentBlockStart = {
    type: 'content_block_start';
    index: number;
    content_block?: {
        type?: 'text';
        text?: string;
    }
}

export type ClaudeStreamDataContentBlockDelta = {
    type: 'content_block_delta';
    index: number;
    delta?: {
        type?: 'text_delta';
        text?: string;
    }
}

export type ClaudeStreamDataContentBlockStop = {
    type: 'content_block_stop';
    index: number;
}

export type ClaudeStreamDataMessageDelta = {
    type: 'message_delta';
    index: number;
    delta?: {
        type: 'text_delta';
        text?: string;
        stop_reason?: string;
        stop_sequence?: string;
    };
    usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        output_tokens?: number;
    }
}

export type ClaudeStreamDataMessageStop = {
    type: 'message_stop';
}

export type ClaudeStreamDataPing = {
    type: 'ping';
}

export type ClaudeStreamDataError = {
    type: 'error';
    error: {
        type: string,
        message: string,
    }
}
export type ClaudeStreamData = ClaudeStreamDataMessageStart | ClaudeStreamDataContentBlockStart | ClaudeStreamDataContentBlockDelta | ClaudeStreamDataContentBlockStop | ClaudeStreamDataMessageDelta | ClaudeStreamDataMessageStop | ClaudeStreamDataPing | ClaudeStreamDataError;