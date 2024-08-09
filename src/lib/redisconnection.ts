// import { Logger } from '@rawfish-stiga/logger';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import Redis, { RedisOptions } from 'ioredis';
import UrlParse from 'url-parse';


// TODO : make this a sperate module / installable package


function getRedisOption(url?: string, name?: string) : RedisOptions {

    // If the url is not defined, check default env variable. If neither this is defined, go
    // with default localhost connection
    if (!url) {
        url = process.env.REDIS_URL as string ?? 'redis://localhost:6379';
    }
    // const connName = name ?? `Redis ${url}`;
    // const connNameLog = `[${connName}] `;
    // // Logger.info(connNameLog + 'init');

    const urlParse = new UrlParse(url);
    const redisOptions: RedisOptions = {
        connectionName: name ?? `Redis ${url}`,
        host: urlParse.hostname,
        port: parseInt(urlParse.port, 10),

        // // protocol: urlParse.protocol,
        // retry_strategy(options: {attempt: number}) {
        //     // Logger.error(connNameLog + `going to reconnect after: ${Math.min(options.attempt * 100, 3000)}`);
        //     return Math.min(options.attempt * 100, 3000);
        // },
        retryStrategy:  (times: number) => {
            return Math.min(times * 100, 3000);
        }
    };
    return redisOptions;
}

export class RedisConnection {
    private m_redisClient: Redis;
    private m_redisOptions: RedisOptions;
    public readonly connNameLOG: string;
    private m_isReady: boolean = false;

    constructor(url?: string, name?: string) {
        this.m_redisOptions = getRedisOption(url, name);

        // this.m_redisClient = new Redis(options);
        // this.m_redisClient.on('ready', () => {
        //     // /*Logger*/.info(options.connNameLog + 'ready');
        //     this.m_isReady = true;
        // });
    }

    // Do we even need this? As connection is established in constructor?
    public async init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.m_isReady) {
                this.m_redisClient = new Redis(this.m_redisOptions);
                this.m_redisClient.on('ready', () => {
                    // /*Logger*/.info(options.connNameLog + 'ready');
                    this.m_isReady = true;
                    console.log("Redis ready");
                    resolve();
                });

                this.m_redisClient.on('error', (error: Error) => {
                    this.m_isReady = false;
                    console.log("Redis failed");
                    console.log(error.message)
                    reject(error);
                })
            }
        });
    }
    // public async init(): Promise<void> {
    //     if (this.m_isReady) {
    //         return;
    //     } else {
    //         return new Promise<void>((resolve, reject) => {
    //             this.m_redisClient.on('ready', () => {
    //                 resolve();
    //             });

    //             this.m_redisClient.on('error', (error: Error) => {
    //                 reject(error);
    //             })
    //         });
    //     }
    // }

    /**
     * return redis client (you must have executed connect() before)
     * @returns
     */
    public client() {
        return this.m_redisClient;
    }

    /**
     * closes redis connection abruptly. For now, no use in waiting
     */
    public async close(kill: boolean = true) {
        kill ? this.m_redisClient.disconnect() : await this.m_redisClient.quit();
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
