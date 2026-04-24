"""
딸기 하우스 센서 시뮬레이터
- 백엔드 /api/readings/ingest 로 주기적 측정값 전송
- 밤/낮, 관수 후 수분 회복 등 현실적 패턴 흉내
사용:
    pip install requests
    python simulate.py --device demo-device-key-0001 --interval 5
"""
import argparse
import math
import random
import time
from datetime import datetime

import requests


class GreenhouseState:
    def __init__(self):
        self.temperature = 22.0
        self.humidity = 65.0
        self.soil_moisture = 55.0
        self.co2 = 700.0
        self.light = 15000.0  # lux

    def step(self, dt_sec, actuations=None):
        now = datetime.now()
        # 낮밤 사이클 (24h)
        hour = now.hour + now.minute / 60
        diurnal = math.sin((hour - 6) / 24 * 2 * math.pi)  # 06시 일출 기준

        # 온도: 주간 20~28, 야간 8~14 목표
        target_temp = 18 + diurnal * 8
        self.temperature += (target_temp - self.temperature) * 0.05 + random.gauss(0, 0.2)

        # 조도
        self.light = max(0, 30000 * max(0, diurnal) + random.gauss(0, 1500))

        # 습도: 온도 올라가면 내려감
        target_hum = 80 - (self.temperature - 15) * 1.5
        self.humidity += (target_hum - self.humidity) * 0.05 + random.gauss(0, 0.5)
        self.humidity = max(30, min(95, self.humidity))

        # CO2: 낮엔 광합성으로 감소, 밤엔 증가
        if diurnal > 0:
            self.co2 += (500 - self.co2) * 0.02
        else:
            self.co2 += (900 - self.co2) * 0.02
        self.co2 += random.gauss(0, 15)

        # 토양수분: 시간당 약 0.5%씩 자연 감소
        self.soil_moisture -= 0.5 * (dt_sec / 3600)

        if actuations:
            for a in actuations:
                if a.get('action') == 'irrigate':
                    bump = 20 + a.get('duration_sec', 60) / 60 * 5
                    self.soil_moisture = min(90, self.soil_moisture + bump)
                elif a.get('action') == 'vent':
                    self.temperature -= 1.5
                    self.humidity -= 5
                elif a.get('action') == 'heat':
                    self.temperature += 2
                elif a.get('action') == 'cool':
                    self.temperature -= 2

        self.soil_moisture = max(5, min(95, self.soil_moisture))

    def payload(self):
        return {
            'temperature': round(self.temperature, 2),
            'humidity': round(self.humidity, 2),
            'soil_moisture': round(self.soil_moisture, 2),
            'co2': round(self.co2, 1),
            'light': round(self.light, 1),
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', required=True, help='device_key')
    parser.add_argument('--url', default='http://localhost:4000/api/readings/ingest')
    parser.add_argument('--interval', type=int, default=5, help='seconds between readings')
    args = parser.parse_args()

    state = GreenhouseState()
    print(f'[sim] 전송 시작 → {args.url} (device={args.device}, interval={args.interval}s)')

    last = time.time()
    last_actions = []
    while True:
        now = time.time()
        state.step(now - last, actuations=last_actions)
        last = now
        last_actions = []

        body = {'device_key': args.device, **state.payload()}
        try:
            r = requests.post(args.url, json=body, timeout=5)
            if r.ok:
                data = r.json()
                last_actions = data.get('fired', []) or []
                tag = '' if not last_actions else ' 🔔 ' + ', '.join(a['action'] for a in last_actions)
                print(f'[{datetime.now().strftime("%H:%M:%S")}] {body}{tag}')
            else:
                print(f'[err] {r.status_code} {r.text}')
        except Exception as e:
            print(f'[err] {e}')

        time.sleep(args.interval)


if __name__ == '__main__':
    main()
