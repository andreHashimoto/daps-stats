var express = require('express')
var app = express()
const fs = require('fs');
var cors = require('cors');
const axios = require('axios');
app.use(cors())


app.get('/dapp', function (req, res) { //start_date=2019-7-6&end_date=2019-10-3
    let {start, end, info} = req.query;
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
        for (let i = 0; i < data['results']['eth'][info].length; i++) {
            worksheet.addRow({ts: new Date(parseInt(data['results']['eth'][info][i]['timestamp']) * 1000),
                eth: data['results']['eth'][info][i]['value'],
                eos: data['results']['eos'][info][i]['value'],
                tron: data['results']['tron'][info][i]['value']});
        }

        sendWorkbook(workbook, res)
    });
})


function sendWorkbook(workbook, response) { 
    var fileName = 'dapps.xlsx';

    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader("Content-Disposition", "attachment; filename=" + fileName);

    workbook.xlsx.write(response).then(function(){
        response.end();
    });
}

app.listen(3100)