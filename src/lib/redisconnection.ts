// import { Logger } from '@rawfish-stiga/logger';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import Redis from 'ioredis';
import UrlParse from 'url-parse';


// TODO : make this a sperate module / installable package


// NOTE: no need to export it at the moment
/*export */function getRedisOption(url?: string, name?: string) {
    if (!url) {
        url = process.env.REDIS_CACHE_URL as string ?? process.env.REDIS_URL as string;
    }
    const connName = name ?? 'Redis ' + url;
    const connNameLog = '[' + connName + '] ';
    // Logger.info(connNameLog + 'init');

    const urlParse = new UrlParse(url);
    const redisOptions = {
        connName,
        connNameLog,
        host: urlParse.hostname,
        port: parseInt(urlParse.port, 10),
        protocol: urlParse.protocol,
        retry_strategy(options: {attempt: number}) {
            // Logger.error(connNameLog + `going to reconnect after: ${Math.min(options.attempt * 100, 3000)}`);
            return Math.min(options.attempt * 100, 3000);
        }
    };
    return redisOptions;
}

export class RedisConnection {
    private m_redisClient;
    public readonly connName: string;
    private m_isReady: boolean = false;

    constructor(url?: string, name?: string) {
        const options = getRedisOption(url, name);
        this.connName = options.connName;

        this.m_redisClient = new Redis(options);
        this.m_redisClient.on('ready', () => {
            // /*Logger*/.info(options.connNameLog + 'ready');
            this.m_isReady = true;
        });
    }

    public async init(): Promise<void> {
        if (this.m_isReady) return;
        return new Promise<void>((resolve) => {
            this.m_redisClient.on('ready', () => {
                resolve();
            });
        });
    }

    /**
     * return redis client (you must have executed connect() before)
     * @returns
     */
    public client() {
        return this.m_redisClient;
    }

    public keys(pattern: string) {
        return new Promise<any>((resolve, reject) => {
            this.m_redisClient.keys(pattern, (error: any, result: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public set(key: string, value: any) {
        return new Promise<void>((resolve, reject) => {
            this.m_redisClient.set(key, value, (error: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    public setWithExpiry(key: string, value: any, expireSeconds: number) {
        return new Promise<void>((resolve, reject) => {
            this.m_redisClient.set(key, value, 'EX', expireSeconds, (error: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    public get(key: string) {
        return new Promise<any>((resolve, reject) => {
            this.m_redisClient.get(key, (error: any, result: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public del(key: string) {
        return new Promise<void>((resolve, reject) => {
            this.m_redisClient.del(key, (error: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    public flush() {
        return new Promise<void>((resolve, reject) => {
            this.m_redisClient.flushall((error: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
}
