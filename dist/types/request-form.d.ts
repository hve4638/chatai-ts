export declare const ChatRole: {
    readonly USER: "USER";
    readonly BOT: "BOT";
    readonly SYSTEM: "SYSTEM";
};
export type ChatRole = typeof ChatRole[keyof typeof ChatRole];
export declare const ChatType: {
    readonly TEXT: "TEXT";
    readonly IMAGE: "IMAGE";
    readonly FILE: "FILE";
};
export type ChatType = typeof ChatType[keyof typeof ChatType];
export type RequestForm = {
    model: string;
    model_detail?: string;
    message: Message[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
    secret: {
        api_key?: string;
        [key: string]: any;
    };
    additional?: any;
};
export type Message = {
    role: ChatRole;
    content: Content[];
};
export type Content = {
    chatType: ChatType;
    text?: string;
    image?: string;
};
export type RequestAPI = (url: string, init: RequestInit) => Promise<any>;
export type RequestOption = {
    requestAPI: RequestAPI;
};
export type RequestDebugOption = {
    /** undefined가 아니라면 요청 data를 가져옵니다. */
    requestData?: {
        url?: string;
        data?: any;
    };
};
//# sourceMappingURL=request-form.d.ts.map