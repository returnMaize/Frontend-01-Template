const css = require("css");
let currentToken = null;
let currentAttribute = null;
let stack = [{type: "document", children:[]}];
let currentTextNode = null;

//将css暂存进一个数组中
let rules = [];
function addCSSRules(text) {//媒体查询的逻辑应该在这里
    let ast = css.parse(text);
    rules.push(...ast.stylesheet.rules);
}

function computeCSS(element) {
    let elements = stack.slice().reverse();//slice() 复制数组,倒序是因为匹配选择器是从内向外的
    if (!element.computedStyle) {
        element.computedStyle = {};
    }
    for (let rule of rules) {
        let selectorParts = rule.selectors[0].split(" ").reverse();

        if (!match(element, selectorParts[0])) {//reverse后的第一条都不匹配就不需要继续匹配了，直接看下一条
            continue;
        }
        let matched = false;
        let j = 1;
        for (let i=0;i < elements.length;i++) {
            if (match(elements[i], selectorParts[j])) {
                j++;
            }
        }
        if (j >= selectorParts.length) {
            matched = true;
        }

        if (matched) {
            //匹配到的话，加入dom树
            let computedStyle = element.computedStyle;
            for (let declaration of rule.declarations) {
                if (!computedStyle[declaration.property]) {
                    computedStyle[declaration.property] = {}
                }
                computedStyle[declaration.property].value = declaration.value;
            }
            console.log(element.computedStyle);
        }
    }
    // let inlineStyle = element.attributes.filter(p => p.name === "style");//原本inline css的处理，toy中略过
    // css.parse("* {"+ inlineStyle+"}");
    // sp = [1, 0, 0, 0];
}
function match(element, selector) {

}
function specificity() {

}
function compare(sp1, sp2) {
    if (sp1[0] - sp2[0]) {

    } else if (sp1[1] - sp2[1]) {

    } else if (sp1[2] - sp2[2]) {

    } else if (sp1[3] - sp2[3]) {

    }
}

function emit(token) {
    let top = stack[stack.length - 1];//栈顶
    if (token.type === "startTag") {
        let element = {
            type: "element",
            children: [],
            attributes: []
        };

        element.tagName = token.tagName;
        for (let p in token) {
            if (p !== "type" && p !== "tagName" && p !== "isSelfClosing") {
                element["attributes"].push({
                    name: p,
                    value: token[p]
                })
            }
        }
        top.children.push(element);
        element.parent = top;

        if (!token.isSelfClosing) {//如果不是自闭合标签的话进栈，等待匹配它的endTag再出栈
            stack.push(element);
        }
        currentTextNode = null;
    } else if (token.type === "endTag") {
        if (top.tagName !== token.tagName) {
            throw new Error("Tag doesn't match!");
        } else {
            stack.pop();
        }
        currentTextNode = null;
    } else if (token.type === "text") {
        if (currentTextNode === null) {
            currentTextNode = {
                type: "text",
                content: ""
            }
            top.children.push(currentTextNode);
        }
        currentTextNode.content += token.content;
    }
}

const EOF = Symbol("EOF");//EOF: End Of File, 唯一标识，解析结束

function data (c) {
    if (c === "<") {//开始接收open tag
        return tagOpen;
    } else if (c === EOF) {//结束
        emit({
            type: "EOF"
        });
        return ;
    } else {//接收文本
        emit({
            type: "text",
            content: c
        });
        return data;
    }
}
function tagOpen (c) {
    if (c === "/") {//这是一个end tag
        return endTagOpen;
    } else if (c.match(/^[a-zA-Z]$/)){//接收open tag的tag name，新建一个token，还不知道是不是自闭合的
        currentToken = {
            type: "startTag",
            tagName: ""
        }
        return tagName(c);
    } else if (c === ">") {
        emit(currentToken)
    } else {
        return;
    }
}
function tagName (c) {
    if (c.match(/^[\t\n\f ]$/)) {//遇到空格，说明后面要处理属性了
        return beforeAttributeName;
    } else if (c === "/") {//说明这是一个自闭合tag
        return selfClosingStartTag;
    } else if (c.match(/^[a-zA-Z]$/)) {//记录tagName,还在处理tagName
        currentToken.tagName += c;//.toLowerCase()标准里面是要转成小写的
        return tagName
    } else if (c === ">") {//tagName结束，回到data
        emit(currentToken);//提交token
        return data;
    } else {
        return tagName;
    }
}

function beforeAttributeName (c) {
    if (c.match(/^[\t\n\f ]$/)) {//如果继续是空格，继续当前状态等待属性名 <div     name
        return beforeAttributeName;
    } else if (c === "/" || c === ">" || c === EOF) {
        return afterAttributeName(c);
    } else if (c === "=") {//非法html，抛错

    } else {//正常属性名，创建一个属性节点
        currentAttribute = {
            name: "",
            value: ""
        }
        return attributeName(c);
    }
}
function attributeName(c) {
    if (c.match(/^[\t\n\f ]$/) || c === "/" || c === ">" || c === EOF) {//Reconsume in the after attribute name state.
        return afterAttributeName(c);
    } else if (c === "=") {//属性名结束，开始处理属性值
        return  beforeAttributeValue;
    } else if (c === "\u0000") {//null，异常抛错

    } else if (c === "\"" || c === "'" || c === "<") {

    } else {//正常属性名，继续接收属性名
        currentAttribute.name += c;
        return attributeName;
    }
}
function afterAttributeName(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return afterAttributeName;
    } else if (c === "/") {
        return selfClosingStartTag;
    } else if (c === "=") {
        return beforeAttributeValue;
    } else if (c === ">") {//Switch to the data state. Emit the current tag token.
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === EOF) {// eof-in-tag parse error

    } else {//Start a new attribute in the current tag token. Set that attribute name and value to the empty string. Reconsume in the attribute name state.
        //在当前token上记录现在这个属性名与对应属性值
        currentToken[currentAttribute.name] = currentAttribute.value;
        //开始一个新的标签属性
        currentAttribute = {
            name: "",
            value: ""
        };
        return attributeName(c);
    }
}
function beforeAttributeValue (c) {
    if (c.match(/^[\t\n\f ]$/) || c === "/" || c === ">" || c === EOF) {
        return beforeAttributeValue;
    } else if (c === "\"") {
        return doubleQuotedAttributeValue;
    } else if (c === "\'") {
        return singleQuotedAttributeValue;
    } else if (c === ">") {

    } else {//不是特殊字符，说明是无引号的属性
        return UnquotedAttributeValue(c);
    }
}
function doubleQuotedAttributeValue (c) {//双引号形式的属性值
    if (c === "\"") {//接收到另一个双引号，说明属性结束，记录属性值
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c === "\u0000") {//null，异常抛错

    } else if (c === EOF) {//eof-in-tag parse error

    } else {//正常记录双引号属性值
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }
}
function singleQuotedAttributeValue (c) {//单引号形式的属性值
    if (c === "\'") {//接收到另一个单引号，说明属性结束，记录属性值
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c === "\u0000") {//null，异常抛错

    } else if (c === EOF) {//eof-in-tag parse error

    } else {//正常记录单引号属性值
        currentAttribute.value += c;
        return singleQuotedAttributeValue;
    }
}
function afterQuotedAttributeValue (c) {//
    if (c.match(/^[\t\n\f ]$/)) {//空格，等待下一个属性名
        return beforeAttributeName;
    } else if (c === "/") {//自闭合标签
        return selfClosingStartTag;
    } else if (c === ">") {//标签结束，提交token并返回data状态

    } else if (c === EOF) {//eof-in-tag parse error

    } else {//todo：存疑，标准里面这里是报错，但是示例里面是记录属性值并进入双引号属性值状态

    }
}
function UnquotedAttributeValue (c) {//无引号形式的属性值
    if (c.match(/^[\t\n\f ]$/)) {//接收到空格，说明属性值接收完了，记录属性标签, 回到等待属性名状态
        currentToken[currentAttribute.name] = currentAttribute.value;
        return beforeAttributeName;
    } else if (c === "/") {//说明是自闭合标签,当前标签解析完成
        currentToken[currentAttribute.name] = currentAttribute.value;
        return selfClosingStartTag;
    } else if (c === ">") {//当前标签完成，提交token后回到data状态
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === "\u0000") {//null，异常抛错

    } else if (c ==="\"" || c ==="\'" || c ==="<" || c ==="=" || c === "`") {//均属于非法的无引号形式的属性值

    } else if (c === EOF) {//eof-in-tag parse error

    } else {//正常记录无引号属性值
        currentAttribute.value += c;
        return UnquotedAttributeValue;
    }
}
function selfClosingStartTag (c) {
    if (c === ">") {//emit自闭合标签，回到data状态
        currentToken.isSelfClosing = true;
        emit(currentToken);
        return data;
    } else if (c === EOF) {//eof-in-tag parse error

    } else {//unexpected-solidus-in-tag parse error

    }
}
function endTagOpen (c) {
    if (c.match(/^[a-zA-Z]$/)) {//Create a new end tag token, set its tag name to the empty string. Reconsume in the tag name state.
        //接收end tag的tagName
        currentToken = {
            type: "endTag",
            tagName: ""
        }
        return tagName(c);
    } else if (c === ">") {//missing-end-tag-name parse error

    } else if (c === EOF) {//eof-before-tag-name parse error

    } else {//invalid-first-character-of-tag-name parse error

    }
}

module.exports.parserHTML = function parserHTML(html) { //用函数实现的状态机，一个函数代表一种状态
    let state = data;
    for (let c of html) {
        state = state(c);
    }
    state = state(EOF);
    console.log(stack[0]);
}