const net = require('net');
const parser = require('./parserHTML');
class Request {
    //method, url = host + port + path
    //body: k/v
    //headers
    constructor(options) {
        this.method = options.method || "GET";
        this.host = options.host;
        this.port = options.port || 80;
        this.body = options.body || {};
        this.path = options.path || "/";
        this.headers = options.headers || {};
        this.headers["Content-Type"] = this.headers["Content-Type"] || "application/x-www-form-urlencoded";
        if (this.headers["Content-Type"] === "application/json") {
            this.bodyText = JSON.stringify(this.body);
        } else if (this.headers["Content-Type"] === "application/x-www-form-urlencoded") {
            this.bodyText = Object.keys(this.body).map(key => `${key}=${encodeURIComponent(this.body[key])}`).join("&");
        }
        this.headers["Content-Length"] = this.bodyText.length;
    }
    toString () {
        //不缩进保持格式正确
        return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join("\r\n")}\r\n
${this.bodyText}`;
    }
    send (connection) {
        return new Promise((resolve, reject) => {
            const parser = new ResponseParser();
            if (connection) {
                connection.write(this.toString());
            } else {
                connection = net.createConnection({
                    host: this.host,
                    port: this.port
                }, () => {
                    connection.write(this.toString());
                })
            }
            connection.on("data", (data) => {
                // 这里返回的是流式数据，data事件可能会触发很多次，需要用状态机来parse
                parser.receive(data.toString());
                if (parser.isFinished) {
                    resolve(parser.response);
                }
                connection.end();
            })
            connection.on("error", (err) => {
                reject(err);
                connection.end();
            })
        })
    }
}
class Response {

}
class ResponseParser {
    constructor() {
        this.WAITING_STATUS_LINE = 0;//开始，等待状态行
        this.WAITING_STATUS_LINE_END = 1;//等待行结束
        this.WAITING_HEADER_NAME = 2;//等待header name
        this.WAITING_HEADER_SPACE = 3;
        this.WAITING_HEADER_VALUE = 4;
        this.WAITING_HEADER_LINE_END = 5;
        this.WAITING_HEADER_BLOCK_END = 6;
        this.WAITING_BODY = 7;//等待body

        this.current = this.WAITING_STATUS_LINE;
        this.statusLine = "";
        this.headers = {};
        this.headerName = "";
        this.headerValue = "";
        this.bodyParser = null;
    }
    get isFinished() {
        return this.bodyParser && this.bodyParser.isFinished;
    }
    get response() {
        //HTTP 1.1 200 OK
        this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([s\S]+)/);
        return {
            statusCode: RegExp.$1,
            statusText: RegExp.$2,
            headers: this.headers,
            body: this.bodyParser.content.join("")
        }
    }
    //处理字符流，一般情况下这里是个buffer，这里简化处理
    receive(string){
        for (let i = 0; i < string.length; i++) {
            this.receiveChar(string.charAt(i));
        }
    }
    receiveChar(char) {
        if (this.current === this.WAITING_STATUS_LINE) {//正在接收status line
            if (char === "\r") {//读到\r时准备结束
                this.current = this.WAITING_STATUS_LINE_END;
            } else if (char === "\n") {//直接结束，准备接收header name
                this.current = this.WAITING_HEADER_NAME;
            } else {
                this.statusLine += char;
            }
        } else if (this.current === this.WAITING_STATUS_LINE_END) {
            if (char === "\n") {//结束，准备接收header name
                this.current = this.WAITING_HEADER_NAME;
            }
        } else if (this.current === this.WAITING_HEADER_NAME) {
            if (char === ':') {//header name以冒号结尾,后面有一个空格
                this.current = this.WAITING_HEADER_SPACE;
            } else if (char === "\r") {//结束接收所有header，开始准备接收body
                this.current = this.WAITING_HEADER_BLOCK_END;//body之前会有一个\n
                //这个时候开始创建body parser，因为在解析完header之前不知道用什么样的transfer encoding去解析
                if (this.headers['Transfer-Encoding'] === 'chunked') {
                    this.bodyParser = new TrunkedBodyParser();
                } //else...为了简单其他encoding的情况忽略
            } else {
                this.headerName += char;
            }
        } else if (this.current === this.WAITING_HEADER_SPACE) {
            if (char === " ") {//接收空格后准备接收header value
                this.current = this.WAITING_HEADER_VALUE;
            }
        } else if (this.current === this.WAITING_HEADER_VALUE) {
            if (char === "\r") {//准备结束接收value，将这行header写入header
                this.current = this.WAITING_HEADER_LINE_END;
                this.headers[this.headerName] = this.headerValue;
                this.headerName = "";
                this.headerValue = "";
            } else {
                this.headerValue += char;
            }
        } else if (this.current === this.WAITING_HEADER_LINE_END) {
            if (char === "\n") {//结束这行的heaer，准备接收下一行headerd
                this.current = this.WAITING_HEADER_NAME;
            }
        } else if (this.current === this.WAITING_HEADER_BLOCK_END) {
            if (char === "\n") {//接收到\n后之后就是body的部分
                this.current = this.WAITING_BODY;
            }
        } else if (this.current === this.WAITING_BODY) {
            this.bodyParser.receiveChar(char);
        }
    }
}

class TrunkedBodyParser {
    constructor() {
        this.WAITING_LENGTH = 0;//开始，等待获取chunk的长度
        this.WAITING_LENGTH_LINE_END = 1;
        this.READING_TRUNK = 2;
        this.WAITING_NEW_LINE = 3;
        this.WAITING_NEW_LINE_END = 4;
        this.length = 0;//计数器，用来计算每个chunk已经读了多少长度
        this.content = [];//用数组保存chunk内容
        this.isFinished = false;//
        this.current = this.WAITING_LENGTH;
    }
    receiveChar(char) {//每个chunk是一行，所有的chunk总是以0为结束,每次读取一个数字，后读固定长度字符，忽略掉所有的\r\n
        // chunk读入例子如下
        // "2"
        // "\r"
        // "\n"
        // "o"
        // "k"
        // "\r"
        // "\n"
        // "0"
        // "\r"
        // "\n"
        // "\r"
        // "\n"
        if (this.current === this.WAITING_LENGTH) {
            if (char === '\r') {//已经得到chunk长度，准备结束读取chunk长度
                if (this.length === 0) {//结束读取chunk长度时长度为0，说明以0结尾，结束body parser
                    this.isFinished = true;
                }
                this.current = this.WAITING_LENGTH_LINE_END;
            } else {//获取即将读取的chunk长度，长度本身也是单个字符，所以要用十进制累加得到长度数字
                this.length *= 16;//这里传来的是16进制
                this.length += parseInt(char, 16); //Number(char)
            }
        } else if (this.current === this.WAITING_LENGTH_LINE_END) {
            if (char === "\n") {//结束读取chunk长度，开始读取chunk
                this.current = this.READING_TRUNK;
            }
        } else if (this.current === this.READING_TRUNK) {
            this.content.push(char);
            this.length--;
            if (this.length === 0) {
                this.current = this.WAITING_NEW_LINE;//当前这个chunk读完了，准备下一个
            }
        } else if (this.current === this.WAITING_NEW_LINE) {
            if (char === "\r") {//处理\r
                this.current = this.WAITING_NEW_LINE_END;
            }
        } else if (this.current === this.WAITING_NEW_LINE_END) {
            if (char === "\n") {//处理\n
                this.current = this.WAITING_LENGTH;//准备读取下一个chunk的长度
            }
        }
    }
}

void (async function () {
    let request = new Request({
        method: "POST",
        host: "127.0.0.1",
        port: 8088,
        path: "/",
        headers: {
            "X-Foo2": "custom"
        },
        body: {
            name: "toy"
        }
    })
    let response = await request.send();
    parser.parserHTML(response.body);//这里实际不是等全部body解析返回之后才传给html parser解析的
})()

