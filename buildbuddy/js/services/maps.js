/**
 * Open a popup window with OpenStreetMap to select address
 * Free - no API key required
 */
export function openMapSelector() {
    const width = 900;
    const height = 650;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    const mapWindow = window.open('', 'SelectAddress', `width=${width},height=${height},left=${left},top=${top}`);
    
    mapWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pick Your Address - BuildBuddy</title>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; }
                .header { padding: 12px 20px; background: #1a1a2e; color: white; display: flex; justify-content: space-between; align-items: center; }
                .header h3 { font-size: 15px; }
                .locate-btn { padding: 8px 16px; background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; }
                .locate-btn:hover { background: rgba(255,255,255,0.25); }
                #map { width: 100%; height: calc(100vh - 110px); }
                .footer { padding: 12px 20px; background: #f8f9fc; display: flex; gap: 10px; align-items: center; border-top: 1px solid #e0e0e0; }
                #selectedAddress { flex: 1; padding: 10px 14px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; background: white; }
                .btn { padding: 10px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; }
                .btn-confirm { background: #00d4ff; color: #1a1a2e; }
                .btn-confirm:hover { background: #00b8e6; }
                .btn-cancel { background: #f0f0f5; color: #666; }
                .btn-cancel:hover { background: #e0e0e0; }
                .custom-marker { background: #f44336; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
            </style>
        </head>
        <body>
            <div class="header">
                <h3>📍 Pick Your Delivery Address</h3>
                <button class="locate-btn" onclick="locateMe()">📍 Use My Location</button>
            </div>
            <div id="map"></div>
            <div class="footer">
                <input type="text" id="selectedAddress" placeholder="Click on the map to select your address...">
                <button class="btn btn-cancel" onclick="window.close()">Cancel</button>
                <button class="btn btn-confirm" onclick="confirmAddress()">✅ Use This Address</button>
            </div>
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
            <script>
                let marker;
                let map;
                
                // Initialize map centered on Malaysia
                map = L.map('map').setView([4.2105, 101.9758], 6);
                
                // OpenStreetMap tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    maxZoom: 19
                }).addTo(map);
                
                // Click to place marker
                map.on('click', function(e) {
                    placeMarker(e.latlng);
                    reverseGeocode(e.latlng);
                });
                
                function placeMarker(latlng) {
                    if (marker) map.removeLayer(marker);
                    
                    marker = L.marker(latlng, {
                        draggable: true
                    }).addTo(map);
                    
                    marker.on('dragend', function() {
                        reverseGeocode(marker.getLatLng());
                    });
                    
                    map.setView(latlng, map.getZoom());
                }
                
                async function reverseGeocode(latlng) {
                    try {
                        const response = await fetch(
                            'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + latlng.lat + '&lon=' + latlng.lng + '&addressdetails=1'
                        );
                        const data = await response.json();
                        document.getElementById('selectedAddress').value = data.display_name || latlng.lat.toFixed(6) + ', ' + latlng.lng.toFixed(6);
                    } catch(e) {
                        document.getElementById('selectedAddress').value = latlng.lat.toFixed(6) + ', ' + latlng.lng.toFixed(6);
                    }
                }
                
                window.locateMe = function() {
                    document.getElementById('selectedAddress').value = 'Locating...';
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            function(pos) {
                                const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                                placeMarker(latlng);
                                reverseGeocode(latlng);
                                map.setView(latlng, 16);
                            },
                            function() {
                                document.getElementById('selectedAddress').value = 'Could not get location. Click on map instead.';
                            }
                        );
                    } else {
                        document.getElementById('selectedAddress').value = 'Geolocation not supported. Click on map instead.';
                    }
                };
                
                window.confirmAddress = function() {
                    const address = document.getElementById('selectedAddress').value;
                    if (!address || address === 'Locating...') {
                        alert('Please select a location on the map first.');
                        return;
                    }
                    window.opener.document.getElementById('shipAddress').value = address;
                    window.close();
                };
            <\/script>
        </body>
        </html>
    `);
    
    mapWindow.document.close();
}