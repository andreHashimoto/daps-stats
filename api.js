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
    let {symbol, start, end} = req.query;
    axios.get(`https://api.dapp.review/api/stats/statsbychain/?start_date=${start}&end_date=${end}`).then(function (response) {
        let data = response.data;
        // console.log(data['results']['eth']['user'][0])
        var Excel = require('exceljs');
        var workbook = new Excel.Workbook();
        var worksheet = workbook.addWorksheet('My Sheet');
        worksheet.columns = [
            { header: 'Timestamp', key: 'ts', width: 32 },
            { header: 'Users', key: 'user', width: 32 }
        ];
        console.log(data['results'][symbol]['user'])
        for (let row of data['results'][symbol]['user']) {
            worksheet.addRow({ts: row['timestamp'], user: row['value']});
        }
        sendWorkbook(workbook, res)
    });
})


function sendWorkbook(workbook, response) { 
    var fileName = 'FileName.xlsx';

    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader("Content-Disposition", "attachment; filename=" + fileName);

    workbook.xlsx.write(response).then(function(){
        response.end();
    });
}

app.listen(3100)