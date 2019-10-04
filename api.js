var express = require('express')
var app = express()
const fs = require('fs');
var cors = require('cors');
const axios = require('axios');
app.use(cors())

app.get('/bands', function (req, res) {
    let {start, end} = req.query;

    let rawdata = fs.readFileSync('./data/bands.json');
    let bands = JSON.parse(rawdata);

    res.send(bands.filter(b => b.ts >= start && b.ts <= end))
})

app.get('/prices', function (req, res) {
    let {start, end} = req.query;

    let rawdata = fs.readFileSync('./data/prices.json');
    let prices = JSON.parse(rawdata);
    res.send(prices.filter(p => {
        p['ts'] = new Date(p['time_period_end']).getTime()
        return p.ts >= start && p.ts <= end
    }))
})

app.get('/dapp-user', function (req, res) { //start_date=2019-7-6&end_date=2019-10-3
    let {start, end} = req.query;
    axios.get(`https://api.dapp.review/api/stats/statsbychain/?start_date=${start}&end_date=${end}`).then(function (response) {
        let data = response.data;
        var Excel = require('exceljs');
        var workbook = new Excel.Workbook();
        var worksheet = workbook.addWorksheet('My Sheet');
        worksheet.columns = [
            { header: 'Timestamp', key: 'ts', width: 22 },
            { header: 'ETH', key: 'eth', width: 22 },
            { header: 'EOS', key: 'eos', width: 22 },
            { header: 'TRON', key: 'tron', width: 22 }
        ];
        for (let et of data['results']['eth']['user']) {
            worksheet.addRow({ts: new Date(parseInt(et['timestamp']) * 1000), eth: et['value']});
        }
        for (let eo of data['results']['eos']['user']) {
            worksheet.addRow({ts: new Date(parseInt(eo['timestamp']) * 1000), eos: eo['value']});
        }
        for (let tr of data['results']['tron']['user']) {
            worksheet.addRow({ts: new Date(parseInt(tr['timestamp']) * 1000), tr: row['value']});
        }
        sendWorkbook(workbook, res)
    });
})


function sendWorkbook(workbook, response) { 
    var fileName = 'DappsUser.xlsx';

    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader("Content-Disposition", "attachment; filename=" + fileName);

    workbook.xlsx.write(response).then(function(){
        response.end();
    });
}

app.listen(3100)