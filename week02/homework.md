# 1. 写一个正则表达式 匹配所有 Number 直接量
```
 匹配所有Number直接量的正则
/^-?[0-9]\d*$|(0x)?[0-9a-fA-F]+|0?[0-7]*|^-?([1-9]\d*\.\d*|0\.\d*[1-9]\d*|0?\.0+|0)$/
```

```
  // 整数
  var str1 = "123";
  var reg = /^-?\d+$/g;
  console.log(reg.test(str1));
  // 浮点数
  var str2 = "11.1234";
  var reg = /^(-?\d+)(\.\d+)?$/g;
  console.log(reg.test(str2));
  // 二进制
  var str3 = "0b00110011";
  var reg = /^0[bB][01]+$/g;
  console.log(reg.test(str3));
  // 八进制
  var str4 = "0o66117711";
  var reg = /^0[oO][0-7]+$/g;
  console.log(reg.test(str4));
  // 十六进制
  var str5 = "0xaf1e7d11";
  var reg = /^0[xX][0-9a-fA-F]+$/g;
  console.log(reg.test(str5));
  // Number
  var reg = /^-?\d+$|^(-?\d+)(\.\d+)?$|^0[bB][01]+$|^0[oO][0-7]+$|^0[xX][0-9a-fA-F]+$/g;
```
# 2. 写一个 UTF-8 Encoding 的函数
 ``` function UTF8Encoding(str) {
  const code = encodeURIComponent(str)
  const bytes = []

  for (let i = 0; i < code.length; i++) {
    const c = code.charAt(i)
    if (c === '%') {
      const hex = code.charAt(i + 1) + code.charAt(i + 2)
      const hexVal = parseInt(hex, 16)
      bytes.push(hexVal)
      i += 2
    } else {
      bytes.push(c.charCodeAt(0))
    }
  }
  return bytes
}
```
# 3. 写一个正则表达式，匹配所有的字符串直接量，单引号和双引号
```
/?:[^"]|\.)*"|'(?:[^']|\.)*|^[\u4E00-\u9FA5A-Za-z0-9]+$ /
```