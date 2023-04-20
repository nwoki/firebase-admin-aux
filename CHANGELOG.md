[3.0.0]
* ported to TS
* rework of the entire lib
    * Now using `ioredis`
    * configuration passed as json string and not seperate values
    * firebase object now handles messaging (if enabled by your plan) as well
    * user create/get/update/delete

[2.0.0]
* async initialize (breaking change)

[1.3.0]
* logs improvements

[1.2.0]
* dependecies updated

[1.1.0]
* fixed request verification: was using wrong set method and expiry was not recognized
