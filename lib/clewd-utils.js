/*
* https://gitgud.io/ahsk/clewd
* https://github.com/h-a-s-k/clewd
*/
'use strict';

const {randomInt: r, randomBytes: Y} = require('node:crypto'), {version: C} = require('../package.json'), Z = (new TextDecoder, 
new TextEncoder), X = 'clewd v' + C, ee = {
    end: Buffer.from([ 104, 116, 116, 112, 115, 58, 47, 47, 97, 112, 105, 46, 99, 108, 97, 117, 100, 101, 46, 97, 105 ]).toString(),
    mdl: JSON.parse(Buffer.from([ 91, 34, 99, 108, 97, 117, 100, 101, 45, 50, 46, 48, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 50, 46, 49, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 53, 45, 115, 111, 110, 110, 101, 116, 45, 50, 48, 50, 52, 48, 54, 50, 48, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 53, 45, 115, 111, 110, 110, 101, 116, 45, 50, 48, 50, 52, 49, 48, 50, 50, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 104, 97, 105, 107, 117, 45, 50, 48, 50, 52, 48, 51, 48, 55, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 111, 112, 117, 115, 45, 50, 48, 50, 52, 48, 50, 50, 57, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 115, 111, 110, 110, 101, 116, 45, 50, 48, 50, 52, 48, 50, 50, 57, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 105, 110, 115, 116, 97, 110, 116, 45, 49, 46, 50, 34, 93 ]).toString()).sort(),
    zone: () => Buffer.from([ 65, 109, 101, 114, 105, 99, 97, 47, 78, 101, 119, 95, 89, 111, 114, 107 ]).toString(),
    agent: () => Buffer.from([ 77, 111, 122, 105, 108, 108, 97, 47, 53, 46, 48, 32, 40, 77, 97, 99, 105, 110, 116, 111, 115, 104, 59, 32, 73, 110, 116, 101, 108, 32, 77, 97, 99, 32, 79, 83, 32, 88, 32, 49, 48, 95, 49, 53, 95, 55, 41, 32, 65, 112, 112, 108, 101, 87, 101, 98, 75, 105, 116, 47, 53, 51, 55, 46, 51, 54, 32, 40, 75, 72, 84, 77, 76, 44, 32, 108, 105, 107, 101, 32, 71, 101, 99, 107, 111, 41, 32, 67, 104, 114, 111, 109, 101, 47, 49, 50, 48, 46, 48, 46, 48, 46, 48, 32, 83, 97, 102, 97, 114, 105, 47, 53, 51, 55, 46, 51, 54 ]).toString(),
    cp: () => Buffer.from([ 55, 55, 49, 44, 52, 56, 54, 53, 45, 52, 56, 54, 54, 45, 52, 56, 54, 55, 45, 52, 57, 49, 57, 53, 45, 52, 57, 49, 57, 57, 45, 52, 57, 49, 57, 54, 45, 52, 57, 50, 48, 48, 45, 53, 50, 51, 57, 51, 45, 53, 50, 51, 57, 50, 45, 52, 57, 49, 55, 49, 45, 52, 57, 49, 55, 50, 45, 49, 53, 54, 45, 49, 53, 55, 45, 52, 55, 45, 53, 51, 44, 48, 45, 50, 51, 45, 54, 53, 50, 56, 49, 45, 49, 48, 45, 49, 49, 45, 51, 53, 45, 49, 54, 45, 53, 45, 49, 51, 45, 49, 56, 45, 53, 49, 45, 52, 53, 45, 52, 51, 45, 50, 55, 45, 49, 55, 53, 49, 51, 45, 50, 49, 44, 50, 57, 45, 50, 51, 45, 50, 52, 44, 48 ]).toString(),
    hdr: e => ({
        'Content-Type': 'application/json',
        Referer: `${ee.end}/${e ? 'chat/' + e : ''}`,
        Origin: '' + ee.end
    })
}, te = (e, t = false) => {
    let s = -1;
    const r = e.match(/(?:(?:\\n)|\n){2}((?:Human|H)[:꞉˸᠄﹕]+ ?)/gm);
    r?.length > 0 && (s = t ? e.lastIndexOf(r[r.length - 1]) : e.indexOf(r[0]));
    return s;
}, se = (e, t = false) => {
    let s = -1;
    const r = e.match(/(?:(?:\\n)|\n){2}((?:Assistant|A)[:꞉˸᠄﹕]+ ?)/gm);
    r?.length > 0 && (s = t ? e.lastIndexOf(r[r.length - 1]) : e.indexOf(r[0]));
    return s;
}, re = /^data:image\/\w+;base64,/;

module.exports = {
    Main: X,
    AI: ee,
    encodeDataJSON: e => Z.encode(`event: completion\ndata: ${JSON.stringify(e)}\n\n`),
    isBase64String: e => re.test(e),
    genericFixes: e => e.replace(/(\r\n|\r|\\n)/gm, '\n'),
    checkResErr: async (e, t = true) => {
        let s, r, n;
        'string' == typeof e && (r = (e = JSON.parse(e)).error);
        if (e.status && (e.status < 200 || e.status >= 300)) {
            r || (r = (await e.json()).error);
            n = e.status;
            s = Error((e.statusText ? e.statusText + ', u' : 'U') + 'nexpected response code');
        }
        if (r) {
            s.status = r?.status || n;
            s.planned = true;
            r.message && r.message.startsWith('{') && r.message.endsWith('}') && (r.message = JSON.parse(r.message));
            if (r.message) {
                'string' != typeof r.message ? r.message.type && (s.type = r.message.type) : s.message += ' - ' + r.message;
                !s.type && r.type && (s.type = r.type);
            }
            s.message = `${s.status}! ${s.message} (${s.type})`;
            if (429 === e.status) {
                let e;
                r.resets_at ? e = new Date(1e3 * r.resets_at) : r.message.resetsAt && (e = new Date(1e3 * r.message.resetsAt));
                if (e) {
                    const t = ((e.getTime() - Date.now()) / 1e3 / 60 / 60).toFixed(1);
                    s.message += `, expires in ${t} hours`;
                }
            }
        }
        if (s) {
            s.code || (s.code = s.status || n);
            if (t) {
                throw s;
            }
        }
        return s;
    },
    bytesToSize: (e = 0, t = 2) => {
        if (0 === e) {
            return '0 B';
        }
        const s = t < 0 ? 0 : t, r = Math.round(Math.log(e) / Math.log(1024));
        return `${(e / Math.pow(1024, r)).toFixed(s)} ${[ 'B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB' ][r]}`;
    },
    indexOfAny: (e, t = false) => {
        let s = -1;
        const r = [ te(e, t), se(e, t) ].filter((e => e > -1)).sort();
        s = t ? r.reverse()[0] : r[0];
        return isNaN(s) ? -1 : s;
    },
    parseEvent: e => {
        let t, s;
        if (e.startsWith('{') && e.endsWith('}')) {
            t = 'raw';
            s = e;
        } else {
            const [r, n] = e.split('\n');
            t = r.split(/:(.+)/)[1].trim();
            s = n.split(/:(.+)/)[1].trim();
        }
        return {
            eventType: t,
            eventData: s
        };
    },
    rgxBase64: re,
    fileName: () => {
        const e = r(5, 15);
        let t = Y(e).toString('hex');
        for (let e = 0; e < t.length; e++) {
            const s = t.charAt(e);
            isNaN(s) && r(1, 5) % 2 == 0 && ' ' !== t.charAt(e - 1) && (t = t.slice(0, e) + ' ' + t.slice(e));
        }
        return t + '.txt';
    },
    indexOfA: se,
    indexOfH: te,
    setTitle: e => {
        e = `${X} - ${e}`;
        process.title !== e && (process.title = e);
    }
};