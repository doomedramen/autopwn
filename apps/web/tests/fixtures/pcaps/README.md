# Test PCAP Files

This directory contains PCAP files used for end-to-end testing of the WiFi cracking workflow.

## Files

### WPA1
- `wpa1-dictionary.cap` - WPA1 handshake with encrypted packets
  - Password: `dictionary`
  - Source: wpa-psk-linksys.cap

### WPA2
- `wpa2-dictionary.cap` - WPA2 handshake with encrypted packets
  - Password: `dictionary`
  - Source: wpa2-psk-linksys.cap

### WPA3
- `wpa3-abcdefgh.cap` - WPA3 PSK SAE authentication
  - SSID: `WPA3-Network`
  - Password: `abcdefgh`
  - Source: wpa3-psk.pcap

## Usage

These files are intended for use in end-to-end tests to verify the complete cracking workflow:
- File upload and processing
- Dictionary-based cracking
- Result verification
- Real-time progress updates via WebSocket

## Security Notice

These files contain network captures with known weak passwords for testing purposes only. They should never be used on real networks or for any malicious activities.