var DHT = require('bittorrent-dht/server')
var fixtures = require('webtorrent-fixtures')
var MemoryChunkStore = require('memory-chunk-store')
var networkAddress = require('network-address')
var series = require('run-series')
var test = require('tape')
var WebTorrent = require('../../')

test('Download second file only', function (t) {
  t.plan(8)

  var dhtServer = new DHT({ bootstrap: false })

  dhtServer.on('error', function (err) { t.fail(err) })
  dhtServer.on('warning', function (err) { t.fail(err) })

  var client1, client2, torrentMagnet

  series([
    function (cb) {
      dhtServer.listen(cb)
    },

    function (cb) {
      client1 = new WebTorrent({
        tracker: false,
        dht: { bootstrap: '127.0.0.1:' + dhtServer.address().port, host: networkAddress.ipv4() }
      })

      client1.dht.on('listening', function () {
        t.equal(client1.dhtPort, client1.dht.address().port)
      })

      client1.on('error', function (err) { t.fail(err) })
      client1.on('warning', function (err) { t.fail(err) })

      var torrent = client1.seed([fixtures.alice.contentPath, fixtures.leaves.contentPath], {store: MemoryChunkStore})

      torrent.on('dhtAnnounce', function () {
        t.pass('finished dht announce')
        announced = true
        maybeDone()
      })

      torrent.on('ready', function () {
        torrentMagnet = torrent.magnetURI
      })

      torrent.load(function (err) {
        t.error(err)
        loaded = true
        maybeDone()
      })

      var announced = false
      var loaded = false
      function maybeDone () {
        if (announced && loaded) cb(null)
      }
    },

    function (cb) {
      client2 = new WebTorrent({
        tracker: false,
        dht: { bootstrap: '127.0.0.1:' + dhtServer.address().port, host: networkAddress.ipv4() }
      })

      client2.on('error', function (err) { t.fail(err) })
      client2.on('warning', function (err) { t.fail(err) })
      client2.on('torrent', function (torrent) {
        torrent.on('download', function () {
          if (torrent.files[0].progress <= 0.01 && torrent.files[1].progress >= 1) {
            t.pass('client2 downloaded file #2 from client1')
            done()
          }
        })
      })

      client2.add(torrentMagnet, { fileSelection: [1], store: MemoryChunkStore })

      function done () {
        setTimeout(cb, 1000, null)
      }
    }
  ], function (err) {
    t.error(err)

    client1.destroy(function (err) {
      t.error(err, 'client1 destroyed')
    })
    client2.destroy(function (err) {
      t.error(err, 'client2 destroyed')
    })
    dhtServer.destroy(function (err) {
      t.error(err, 'dht server destroyed')
    })
  })
})
