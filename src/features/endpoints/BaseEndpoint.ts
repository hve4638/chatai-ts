import { ChatAIRequest, ValidChatRequestForm } from '@/types/request';
import { ChatAIResultResponse } from '@/types/response';
import { EndpointAction, ChatAIRequestOption } from './types';

import { AxiosResponse, AxiosRequestConfig } from 'axios'
import { AsyncQueue } from '@/utils';
import { AsyncQueueConsumer, AsyncQueueProducer } from '@/utils/AsyncQueue';

abstract class BaseEndpoint {
    abstract get baseURL():string;

    /** 요청 수행 전 호출 */
    async preprocess(form: ValidChatRequestForm, option: ChatAIRequestOption):Promise<EndpointAction> { return EndpointAction.Continue; }
    /** 요청 수행 후 호출 */
    async postprocess(form: ValidChatRequestForm, option: ChatAIRequestOption):Promise<void> {}

    /** Request URL 리턴, 여러번 호출 될 수 있음 */
    abstract makeRequestURL(form: ValidChatRequestForm, option: ChatAIRequestOption): Promise<string>;
    /** Request Body 리턴, 여러번 호출 될 수 있음 */
    abstract makeRequestData(form: ValidChatRequestForm, option: ChatAIRequestOption): Promise<object>;
    /** Request Config 리턴, 여러번 호출 될 수 있음 */
    abstract makeRequestConfig(form: ValidChatRequestForm, option: ChatAIRequestOption): Promise<AxiosRequestConfig<any>>;

    /** fetch 실패 시 */
    async catchFetchFailed(error:unknown, retryCount:number):Promise<EndpointAction> { return EndpointAction.Continue; }
    /** response 실패 시 */
    async catchResponseFailed(response: AxiosResponse, retryCount: number):Promise<EndpointAction> { return EndpointAction.Continue; }
    /** 최종 결과물 리턴 (Response OK 시) */
    abstract parseResponseOK(request:ChatAIRequest, response:AxiosResponse):Promise<ChatAIResultResponse>;
    /** 최종 결과물 리턴 (Response Fail 시) */
    async parseResponseFail(request:ChatAIRequest, response:AxiosResponse):Promise<ChatAIResultResponse> {
        return {
            ok: false,
            http_status: response.status,
            http_status_text: response.statusText,
            raw: response.data,
            content: [],
            warning: null,
            tokens: {
                input: 0,
                output: 0,
                total : 0,
            },
            finish_reason: '',
        }
    }

    /** 민감정보 마스킹 */
    maskSecret(form: ValidChatRequestForm):ValidChatRequestForm {
        const copied = structuredClone(form);
        this.maskField(copied.secret);
        return copied;
    }

    protected maskField(data:object) {
        if (!data || typeof data !== 'object') return data;
    
        for (const [key, value] of Object.entries(data)) {
            data[key] = (typeof value === 'string') ? 'SECRET' : this.maskField(value);
        }
    
        return data;
    }

    async parseStream(streamConsumer:AsyncQueueConsumer<string>, messageProducer:AsyncQueueProducer<string>):Promise<ChatAIResultResponse> {
        const streamTextFragment:string[] = [];
        const resultResponse:ChatAIResultResponse = {
            ok: true,
            http_status: 200,
            http_status_text: 'OK',
            raw: {},
            content: [],
            warning: null,
            tokens: {
                input: 0,
                output: 0,
                total : 0,
            },
            finish_reason: '',
        }

        while (true) {
            const chunkData = await this.mergeStreamFragment(streamConsumer);
            if (chunkData === null) break;

            const streamText = await this.parseStreamData(chunkData, resultResponse);
            if (streamText) {
                streamTextFragment.push(streamText);
                messageProducer.enqueue(streamText);
            }
        }

        messageProducer.enableBlockIfEmpty(false);
        resultResponse.content.push(streamTextFragment.join(''));
        return resultResponse;
    }

    /**
     * 스트림 큐로부터 데이터 조각을 수집하여 하나의 데이터로 병합
     * 
     * 큐 모두 소비 시 null 반환
     * 
     * @param streamFragmentConsumer 
     */
    protected abstract mergeStreamFragment(streamConsumer:AsyncQueueConsumer<string>):Promise<unknown|null>;

    /**
     * 스트림 데이터에서 응답 텍스트를 추출해 반환
     * 
     * 필요시 최종 response 객체에 추가 정보를 갱신할 수 있음
     * 
     * @param data 스트림 데이터
     * @param responseCandidate 정보를 갱신할 response 객체
     * @returns 응답 텍스트
     */
    protected abstract parseStreamData(data:unknown, resultResponse:ChatAIResultResponse):Promise<string|undefined>;

    async parseResponseStream(streamQueue:AsyncQueue<string>, outputMessageQueue:AsyncQueue<string>):Promise<ChatAIResultResponse> {
        const contents:string[] = [];
        const response:ChatAIResultResponse = {
            ok: true,
            http_status: 200,
            http_status_text: 'OK',
            raw: {},
            content: [],
            warning: null,
            tokens: {
                input: 0,
                output: 0,
                total : 0,
            },
            finish_reason: '',
        }

        let partOfChunk:string|null = null;
        while (true) {
            const line = await streamQueue.dequeue();
            if (line === null) break;
            
            let text:string;
            if (partOfChunk === null) {
                if (!line.startsWith('data:')) {
                    continue;
                }
                
                text = line.slice(5).trim();
            }
            else {
                text = partOfChunk + line;
                partOfChunk = null;
            }

            let chunkData:any;
            try {
                chunkData = JSON.parse(text);
            }
            catch (e) {
                partOfChunk = text;
                console.error('Incomplete chunk', text);
                continue;
            }

            const usage = chunkData.usageMetadata;
            if (usage) {
                response.tokens = {
                    input: usage.promptTokenCount ?? 0,
                    output: usage.candidatesTokenCount ?? 0,
                    total: usage.totalTokenCount ?? 0
                }
            }

            const firstCandidate = chunkData.candidates?.[0];
            if (firstCandidate) {
                if (firstCandidate.finishReason) {
                    const reason = firstCandidate.finishReason;
                    response.finish_reason = firstCandidate.finishReason;

                    let warning: string | null;
                    if (reason == 'STOP') warning = null;
                    else if (reason == 'SAFETY') warning = 'blocked by SAFETY';
                    else if (reason == 'MAX_TOKENS') warning = 'max token limit';
                    else warning = `unhandle reason : ${reason}`;

                    response.warning = warning;
                }
                const content = firstCandidate.content?.parts[0]?.text ?? '';
                outputMessageQueue.enqueue(content);
                contents.push(content);
            }
        }
        outputMessageQueue.enableBlockIfEmpty(false);
        response.content.push(contents.join(''));
        return response;
    }

    // async stream(
    //     form: ChatAIRequestForm,
    //     debug: RequestDebugOption = {}
    // ) {
    //     const [url, data, config] = this.makeRequestData(form, { stream: true });
    //     config['responseType'] = 'stream';

    //     try {
    //         const res = await axios.post(url, data, config);

    //         if (!debug.unmaskSecret) {
    //             const maskedForm = {
    //                 ...form,
    //                 secret: BaseEndpoint.deepCopy(form.secret)
    //             };
    //             BaseEndpoint.mask(maskedForm.secret)

    //             const [url, data, config] = this.makeRequestData(maskedForm, { stream: true });
    //             config['responseType'] = 'stream';
    //             return await this.handleStream(res, { form, url, data, config });
    //         }
    //         else {
    //             return await this.handleStream(res, { form, url, data, config });
    //         }

    //     }
    //     catch (error: unknown) {
    //         if (axios.isAxiosError(error)) {
    //             return await this.handleStreamError(error, { form, url, data, config })
    //         }
    //         else {
    //             throw error;
    //         }
    //     }
    // }

    // async handleStream(res: AxiosResponse, { form, ur 

    // protected async handleStreamError(error: AxiosError, { form, url, data, config }: {
    //     form: ChatAIRequestForm,
    //     url: string,
    //     data: object,
    //     config: object
    // }): Promise<[AsyncGenerator<string, void, unknown>, Promise<ChatAIResult>]> {
    //     async function *emptyGenerator() {
    //         return;
    //     }
    //     const resultPromise = new Promise<ChatAIResult>((resolve) => {
    //         resolve({
    //             request: {
    //                 form: form,
    //                 url: url,
    //                 headers: (config as any).headers ?? {},
    //                 data: data,
    //             },
    //             response : {
    //                 ok: false,
    //                 http_status: error.response?.status ?? 0,
    //                 http_status_text: error.response?.statusText ?? '',
    //                 raw: error.response?.data ?? {},
    //                 content: [],
    //                 warning: null,
    //                 tokens: {
    //                     input: 0,
    //                     output: 0,
    //                     total : 0,
    //                 },
    //                 finish_reason: '',
    //             }
    //         });
    //     });

    //     return [emptyGenerator(), resultPromise];
    // }
}

export default BaseEndpoint;