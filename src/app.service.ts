import { Injectable } from '@nestjs/common';
const ProtoBuf = require( "protobufjs" );
const fs = require( "fs" );

var ENV:any = {};
var lineMap = {
        "ace": "-ace",
        "bdfm": "-bdfm",
        'g': '-g',
        "jz": "-jz",
        "nqrw": "-nqrw",
        'l': '-l',
        "1234567": "",
        "sir": "-si",
};

function setEnv( path )
{
        var content = fs.readFileSync( path ).toString();
        var lines = content.split('\n');
        var parts, key, val, i;
        for( i=0; i<lines.length; i++ )
        {
                parts = lines[i].split('=');
                key = parts[0];
                val = parts.slice(1).join('=');
                ENV[key] = val;
        }
}
function queryLines( query )
{
        var each = query.toLowerCase().split('');
        var selects = {}, p, i;
        for( p in lineMap )
        {
                if ( query.includes(p) )
                {
                        selects[p] = lineMap[p];
                        break;
                }
        }
        return selects;
}
function getDateTime()
{
        var dt = Intl.DateTimeFormat(
                "en-US", {
                        dateStyle: "full",
                        timeStyle: "long",
                        timeZone: "America/New_York",
                }
        );
        return dt.format( new Date() );
}
function secToTime( sec )
{
        // *epoch* seconds btw.
        // no idea why.
        // go ask GTFS devs why not milliseconds.
        var ms = sec * 1000;
        var dt = Intl.DateTimeFormat(
                "en-US", {
                        timeStyle: "short",
                        timeZone: "America/New_York",
                }
        );
        return dt.format( new Date(ms) );
}
async function getSchedules() {
        var strData = fs.readFileSync( "schedules.json" ).toString();
        var data = JSON.parse( strData );
        var updates, update, trip, stops, sec, i, j;
        for( i=0; i<data.entity.length; i++ )
        {
                update = data.entity[i].tripUpdate;
                if ( !update ) continue;

                updates = update.stopTimeUpdate;
                if ( !updates ) continue;

                for( j=0; j<updates.length; j++ )
                {
                        if ( !updates[j].arrival ) continue;

                        sec = parseInt( updates[j].arrival.time );
                        switch( updates[j].stopId )
                        {
                                case "L16N":
                                        console.log( "L MTN", secToTime(sec) );
                                        break;
                                case "L16S":
                                        console.log( "L QNS", secToTime(sec) );
                                        break;
                                default:
                                        break;
                        }
                }
        }
}

@Injectable()
export class AppService {
        constructor(){
                setEnv( ".env" );
                this.updateSchedules();
                setInterval( this.updateSchedules, 20_000 );
        }
        async updateSchedules() {
                // var lines = queryLines( "acebdfmgjznqrwl1234567sir" );
                var lines = queryLines( "l" );
                for( var p in lines )
                {
                        var url = `${ENV.MTA_REALTIME_BASE_URL}%2Fgtfs${lines[p]}`
                        var headers = { "x-api-key": ENV.MTA_API_KEY };
                        var resp = await fetch( url, { headers } );
                        var buff = new Uint8Array( await resp.arrayBuffer() );
                        var root = ProtoBuf.loadSync( "src/gtfs-realtime.proto" );
                        var feedMsg = root.lookupType( "transit_realtime.FeedMessage" );
                        var data = feedMsg.decode( buff );
                        fs.writeFileSync( "schedules.json", JSON.stringify(data) );
                        console.log( "updated all schedules at", getDateTime() );
                }
                await getSchedules();
        }
}
