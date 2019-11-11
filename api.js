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
            let date = new Date(parseInt(data['results']['eth'][info][i]['timestamp']) * 1000)
            let day = date.getDate();
            let monthIndex = date.getMonth();
            let year = date.getFullYear();
            worksheet.addRow({ts: `${day}/${monthIndex+1}/${year}`,
                eth: data['results']['eth'][info][i]['value'],
                eos: data['results']['eos'][info][i]['value'],
                tron: data['results']['tron'][info][i]['value']});
        }

        sendWorkbook(workbook, res, `dapps_${info}_${start}_${end}.xlsx`)
    });
})

app.get('/liquidation', function (req, res) {
    let {from, to} = req.query;
    console.log(`From: ${new Date(Date.parse(from)).getTime()}`)
    console.log(`To: ${new Date(Date.parse(to)).getTime()}`)
    let reqBody = {
        "from": new Date(Date.parse(from)).getTime().toString(),
        "to": new Date(Date.parse(to)).getTime().toString(),
        "queries": [
            {
                "refId": "A",
                "intervalMs": 900000,
                "maxDataPoints": 179,
                "datasourceId": 2,
                "rawSql": "SELECT \n  $__time(date),\n  size as buy_liquidations\nFROM \n  bitmex_liquidation\nWHERE \n  $__timeFilter(date) and symbol = 'XBTUSD' and side = 'Buy'\nORDER BY\n  time",
                "format": "time_series"
            },
            {
                "refId": "B",
                "intervalMs": 900000,
                "maxDataPoints": 179,
                "datasourceId": 2,
                "rawSql": "SELECT \n  $__time(date),\n  size as sell_liquidations\nFROM \n  bitmex_liquidation \nWHERE \n  $__timeFilter(date) and symbol = 'XBTUSD' and side = 'Sell'\nORDER BY\n  time",
                "format": "time_series"
            },
            {
                "refId": "C",
                "intervalMs": 900000,
                "maxDataPoints": 179,
                "datasourceId": 2,
                "rawSql": "SELECT \n  $__timeGroup(date, '1h'),\n  sum(size) as total_hourly_liquidations\nFROM \n  bitmex_liquidation \nWHERE \n  $__timeFilter(date) and symbol = 'XBTUSD'\nGROUP BY\n  time\nORDER BY\n  time",
                "format": "time_series"
            }
        ]
     }
    axios.post(`https://www.skew.com/api/tsdb/query`, reqBody).then(function (response) {
        let data = response.data;
        var Excel = require('exceljs');
        var workbook = new Excel.Workbook();
        var worksheetBuy = workbook.addWorksheet('Buy');
        var worksheetSell = workbook.addWorksheet('Sell');
        var worksheetHour = workbook.addWorksheet('Hour');
        worksheetBuy.columns = [
            { header: 'Buy', key: 'b', width: 22 },
            { header: 'Buy Date', key: 'bd', width: 22 }
        ];
        worksheetSell.columns = [
            { header: 'Sell', key: 's', width: 22 },
            { header: 'Sell Date', key: 'sd', width: 22 }
        ];
        worksheetHour.columns = [
            { header: 'Hourly Liquidations', key: 'hl', width: 22 },
            { header: 'Hourly Liquidations Date', key: 'hld', width: 22 }
        ];
        for (const point of data['results']['A']['series'][0]['points']) {
            worksheetBuy.addRow({
                b: point[0],
                bd: new Date(point[1]).toUTCString()
            });
        }
        for (const point of data['results']['B']['series'][0]['points']) {
            worksheetSell.addRow({
                s: point[0],
                sd: new Date(point[1]).toUTCString()
            });
        }
        for (const point of data['results']['C']['series'][0]['points']) {
            worksheetHour.addRow({
                hl: point[0],
                hld: new Date(point[1]).toUTCString()
            });
        }
        sendWorkbook(workbook, res, `liquidation.xlsx`)
    });
})

app.get('/volume-oi-cme', function (req, res) {
    let {from, to} = req.query;
    console.log(`From: ${new Date(Date.parse(from)).getTime()}`)
    console.log(`To: ${new Date(Date.parse(to)).getTime()}`)
    let reqBody = {
        "from": new Date(Date.parse(from)).getTime().toString(),
        "to": new Date(Date.parse(to)).getTime().toString(),
        "queries": [
            {
                "refId": "B",
                "intervalMs": 43200000,
                "maxDataPoints": 117,
                "datasourceId": 2,
                "rawSql": "SELECT\n  btc_oi.time as time, btc_oi.btc_open_interest * cme_price.price as open_interest\nFROM\n  (SELECT\n    TO_DATE(\"Trade Date\" :: VARCHAR(8), 'YYYYMMDD') as time,\n    sum(\"Open Interest\")*5 as btc_open_interest\n  FROM cme_eod\n  WHERE \"Product Code\" = 'BTC'\n  GROUP BY time) btc_oi\nLEFT OUTER JOIN\n  (SELECT\n    date_trunc('day', date) as time,\n    avg(price) as price\n  FROM cme_index\n  WHERE\n    $__timeFilter(date) and underlying = 'BTC'\n  GROUP BY time) cme_price\nON\n  btc_oi.time = cme_price.time\nORDER BY btc_oi.time asc",
                "format": "time_series"
            },
            {
                "refId": "A",
                "intervalMs": 43200000,
                "maxDataPoints": 117,
                "datasourceId": 2,
                "rawSql": "SELECT\n  btc_vol.time as time, btc_vol.btc_volume * cme_price.price as daily_volume\nFROM\n  (SELECT\n    TO_DATE(\"Trade Date\" :: VARCHAR(8), 'YYYYMMDD') as time,\n    sum(\"Total Volume\")*5 as btc_volume\n  FROM cme_eod\n  WHERE \"Product Code\" = 'BTC'\n  GROUP BY time) btc_vol\nLEFT OUTER JOIN\n  (SELECT\n    date_trunc('day', date) as time,\n    avg(price) as price\n  FROM cme_index\n  WHERE\n    $__timeFilter(date) and underlying = 'BTC'\n  GROUP BY time) cme_price\nON\n  btc_vol.time = cme_price.time\nORDER BY btc_vol.time asc",
                "format": "time_series"
            }
        ]
    }
    axios.post(`https://www.skew.com/api/tsdb/query`, reqBody).then(function (response) {
        let data = response.data;
        var Excel = require('exceljs');
        var workbook = new Excel.Workbook();
        var worksheetOI = workbook.addWorksheet('Open Interest');
        var worksheetDailyVolume = workbook.addWorksheet('Daily Volume');
        worksheetOI.columns = [
            { header: 'Open Interest', key: 'oi', width: 22 },
            { header: 'Date', key: 'd', width: 22 }
        ];
        worksheetDailyVolume.columns = [
            { header: 'Volume', key: 'v', width: 22 },
            { header: 'Date', key: 'd', width: 22 }
        ];
        for (const point of data['results']['A']['series'][0]['points']) {
            worksheetDailyVolume.addRow({
                v: point[0],
                d: new Date(point[1]).toISOString()
            });
        }
        for (const point of data['results']['B']['series'][0]['points']) {
            worksheetOI.addRow({
                oi: point[0],
                d: new Date(point[1]).toISOString()
            });
        }
        sendWorkbook(workbook, res, `volume-oi-cme.xlsx`)
    });
})


app.get('/volume-oi-bitmex', function (req, res) {
    let {from, to} = req.query;
    console.log(`From: ${new Date(Date.parse(from)).getTime()}`)
    console.log(`To: ${new Date(Date.parse(to)).getTime()}`)
    let reqBody = {
        "from": new Date(Date.parse(from)).getTime().toString(),
        "to": new Date(Date.parse(to)).getTime().toString(),
        "queries": [
            {
                "refId": "A",
                "intervalMs": 900000,
                "maxDataPoints": 179,
                "datasourceId": 2,
                "rawSql": "SELECT\n  $__time(date),\n  openinterest\nFROM\n  bitmex_openinterest\nWHERE\n  $__timeFilter(date) and symbol = 'XBTUSD'\nORDER BY\n  date asc\n",
                "format": "time_series"
            },
            {
                "refId": "B",
                "intervalMs": 900000,
                "maxDataPoints": 179,
                "datasourceId": 2,
                "rawSql": "SELECT bitmex_openinterest.time as time, bitmex_openinterest.openinterest/cme_cf_brr.price as btc_openinterest\nFROM\n  (SELECT\n    date_trunc('minute', date) as time,\n    avg(openinterest) as openinterest\n  FROM\n    bitmex_openinterest\n  WHERE\n    $__timeFilter(date) and symbol = 'XBTUSD'\n  GROUP BY\n    time\n  ORDER BY\n    time asc) bitmex_openinterest\n  LEFT OUTER JOIN\n    (SELECT\n      date_trunc('minute', date) as time,\n      avg(price) as price\n    FROM\n      cme_index\n    WHERE\n      $__timeFilter(date) and underlying = 'BTC'\n    GROUP BY\n      time\n    ORDER BY\n      time asc) cme_cf_brr\nON bitmex_openinterest.time = cme_cf_brr.time\nORDER BY\n  bitmex_openinterest.time",
                "format": "time_series"
            }
        ]
    }
    axios.post(`https://www.skew.com/api/tsdb/query`, reqBody).then(function (response) {
        let data = response.data;
        var Excel = require('exceljs');
        var workbook = new Excel.Workbook();
        var worksheetBitmex = workbook.addWorksheet('Bitmex');
        var worksheetBTC = workbook.addWorksheet('BTC');
        worksheetBitmex.columns = [
            { header: 'Volume', key: 'v', width: 22 },
            { header: 'Date', key: 'd', width: 22 }
        ];
        worksheetBTC.columns = [
            { header: 'Volume', key: 'v', width: 22 },
            { header: 'Date', key: 'd', width: 22 }
        ];
        for (const point of data['results']['A']['series'][0]['points']) {
            worksheetBitmex.addRow({
                v: point[0],
                d: new Date(point[1]).toISOString()
            });
        }
        for (const point of data['results']['B']['series'][0]['points']) {
            worksheetBTC.addRow({
                v: point[0],
                d: new Date(point[1]).toISOString()
            });
        }
        sendWorkbook(workbook, res, `volume-oi-bitmex.xlsx`)
    });
})

function sendWorkbook(workbook, response, fileName) { 
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader("Content-Disposition", "attachment; filename=" + fileName);

    workbook.xlsx.write(response).then(function(){
        response.end();
    });
}

app.listen(3100)