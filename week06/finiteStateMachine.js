let match1 = string => { //找到a
    for(let char of string) {
        if (char === "a") {
            return true
        }
    }
    return false
}


let match2 = string => { //找ab
    let foundA = false;
    for (let char of string) {
        if (char === "a") {
            foundA = true;
        } else if (char === "b" && foundA) {
            return true;
        } else {
            foundA = false;
        }
    }
    return false;
}

let match3 = string => { //找到abcdef
    let foundA, foundB, foundC, foundD, foundE;
    for (let char of string) {
        if (char === "a") {
            foundA = true
        } else if (foundA && char === "b") {
            foundB = true;
        } else if (foundB && char === "c") {
            foundC = true;
        } else if (foundC && char === "d") {
            foundD = true;
        } else if (foundD && char === "e") {
            foundE = true;
        } else if (foundE && char === "f") {
            return true;
        } else {
            foundA = foundB = foundC = foundD = foundE = false;
        }
    }
    return false;
}
console.log(match3("abcde"));

//函数实现的状态机
function match(string) {
    let state = start;
    for (let c of string) {
        state = state(c);
    }
    return state === end;
}

function start(c) {
    if (c === 'a') {
        return foundA;
    } else {
        return start;
    }
}

function end(c) {//返回自身，这样状态不可能再被改变
    return end;
}

function foundA(c) {
    if (c === 'b') {
        return foundB;
    } else {
        return start(c);//return start的时aa的情况无法处理，返回start(c)相当于直接跳入start状态处理
    }
}

function foundB(c) {
    if (c === 'c') {
        return foundC;
    } else {
        return start(c);
    }
}

function foundC(c) {
    if (c === 'd') {
        return end;
    } else {
        return start(c);
    }
}

console.log(match('123abcdddefwwabcdef'));