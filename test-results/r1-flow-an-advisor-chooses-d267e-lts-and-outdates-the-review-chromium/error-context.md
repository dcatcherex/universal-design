# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: r1-flow.spec.ts >> an advisor chooses the primary benchmark, which changes results and outdates the review
- Location: tests\e2e\r1-flow.spec.ts:84:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.inspector-sidebar .benchmark-policy').getByLabel('เกณฑ์หลัก', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]
  - generic [ref=e12]:
    - banner [ref=e13]:
      - button "หน้าแรก" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: บ
        - generic [ref=e16]:
          - strong [ref=e17]: บ้านอยู่ดี
          - generic [ref=e18]: วางแผนปรับบ้านให้อยู่สบายขึ้น
      - heading "ตัวอย่างห้องนั่งเล่น — โครงการสมมติ" [level=1] [ref=e20]
      - generic [ref=e21]:
        - button "ภาษา" [ref=e22] [cursor=pointer]: EN
        - generic [ref=e23]:
          - button "ไฟล์โครงการ" [ref=e24] [cursor=pointer]
          - generic [ref=e25]: บันทึกบนอุปกรณ์นี้แล้ว
        - button "ส่งออก" [ref=e27] [cursor=pointer]
        - button "สร้างโครงการใหม่" [ref=e28] [cursor=pointer]
    - generic [ref=e29]:
      - group "เลือกแผนผัง" [ref=e30]:
        - button "ก่อนปรับปรุง" [pressed] [ref=e31] [cursor=pointer]
        - button "หลังปรับปรุง" [ref=e32] [cursor=pointer]
      - generic [ref=e33]:
        - button "หน้าแรก" [ref=e34] [cursor=pointer]
        - button "แก้ไขห้องปัจจุบัน" [ref=e35] [cursor=pointer]
        - button "เลิกทำ" [ref=e36] [cursor=pointer]: ↶
        - button "ทำซ้ำ" [disabled]: ↷
        - group "มุมมองแผนผัง" [ref=e38]:
          - button "แผนผัง 2 มิติ" [pressed] [ref=e39] [cursor=pointer]
          - button "มุมมองผนัง" [ref=e40] [cursor=pointer]
          - button "มุมมอง 3 มิติ" [ref=e41] [cursor=pointer]
      - group "โหมด" [ref=e42]:
        - button "ครอบครัว" [ref=e43] [cursor=pointer]
        - button "ผู้ให้คำปรึกษา" [pressed] [ref=e44] [cursor=pointer]
    - generic [ref=e45]:
      - complementary [ref=e46]:
        - region [ref=e47]:
          - generic [ref=e48]:
            - generic [ref=e49]:
              - paragraph [ref=e50]: วางสิ่งของ
              - heading "เพิ่มสิ่งของ" [level=2] [ref=e51]
            - generic [ref=e52]: "10"
          - paragraph [ref=e53]: เลือกสิ่งของ แล้วคลิกบนแผนผัง
          - group "กรองตามประเภท" [ref=e54]:
            - button "ทั้งหมด" [pressed] [ref=e55] [cursor=pointer]
            - button "ที่นั่ง" [ref=e56] [cursor=pointer]
            - button "โต๊ะ" [ref=e57] [cursor=pointer]
            - button "ที่เก็บของ" [ref=e58] [cursor=pointer]
            - button "แสงสว่าง" [ref=e59] [cursor=pointer]
            - button "พรม" [ref=e60] [cursor=pointer]
            - button "กำหนดเอง" [ref=e61] [cursor=pointer]
          - generic [ref=e62]:
            - button "โซฟา, 2100 × 900 × 850 mm" [ref=e63] [cursor=pointer]:
              - generic [ref=e65]: ＋
              - generic [ref=e66]:
                - strong [ref=e67]: โซฟา
                - generic [ref=e68]: 210 × 90 ซม.
            - button "เก้าอี้นวม, 850 × 850 × 900 mm" [ref=e69] [cursor=pointer]:
              - generic [ref=e71]: ＋
              - generic [ref=e72]:
                - strong [ref=e73]: เก้าอี้นวม
                - generic [ref=e74]: 85 × 85 ซม.
            - button "โต๊ะกลาง, 1100 × 600 × 450 mm" [ref=e75] [cursor=pointer]:
              - generic [ref=e77]: ＋
              - generic [ref=e78]:
                - strong [ref=e79]: โต๊ะกลาง
                - generic [ref=e80]: 110 × 60 ซม.
            - button "โต๊ะข้าง, 450 × 450 × 550 mm" [ref=e81] [cursor=pointer]:
              - generic [ref=e83]: ＋
              - generic [ref=e84]:
                - strong [ref=e85]: โต๊ะข้าง
                - generic [ref=e86]: 45 × 45 ซม.
            - button "เก้าอี้รับประทานอาหาร, 500 × 550 × 850 mm" [ref=e87] [cursor=pointer]:
              - generic [ref=e89]: ＋
              - generic [ref=e90]:
                - strong [ref=e91]: เก้าอี้รับประทานอาหาร
                - generic [ref=e92]: 50 × 55 ซม.
            - button "โต๊ะรับประทานอาหาร, 1400 × 800 × 750 mm" [ref=e93] [cursor=pointer]:
              - generic [ref=e95]: ＋
              - generic [ref=e96]:
                - strong [ref=e97]: โต๊ะรับประทานอาหาร
                - generic [ref=e98]: 140 × 80 ซม.
            - button "ตู้เตี้ย, 1200 × 400 × 800 mm" [ref=e99] [cursor=pointer]:
              - generic [ref=e101]: ＋
              - generic [ref=e102]:
                - strong [ref=e103]: ตู้เตี้ย
                - generic [ref=e104]: 120 × 40 ซม.
            - button "โคมไฟตั้งพื้น, 350 × 350 × 1600 mm" [ref=e105] [cursor=pointer]:
              - generic [ref=e107]: ＋
              - generic [ref=e108]:
                - strong [ref=e109]: โคมไฟตั้งพื้น
                - generic [ref=e110]: 35 × 35 ซม.
            - button "พรม, 1800 × 1200 × 10 mm" [ref=e111] [cursor=pointer]:
              - generic [ref=e113]: ＋
              - generic [ref=e114]:
                - strong [ref=e115]: พรม
                - generic [ref=e116]: 180 × 120 ซม.
            - button "สิ่งของกำหนดเอง, 600 × 600 × 600 mm" [ref=e117] [cursor=pointer]:
              - generic [ref=e119]: ＋
              - generic [ref=e120]:
                - strong [ref=e121]: สิ่งของกำหนดเอง
                - generic [ref=e122]: 60 × 60 ซม.
      - main [ref=e123]:
        - generic [ref=e124]:
          - generic [ref=e125]:
            - generic [ref=e126]:
              - paragraph [ref=e127]: แผนผังห้อง
              - generic [ref=e128]: 6.00 × 5.00 m
            - generic [ref=e129]: ประมาณการ
          - group "แผนผังห้อง 6.0 × 5.0 m" [ref=e131]:
            - 'button "แนวทางเดิน: แนวทางเดินตัวอย่าง — ความกว้างเพื่อสาธิต"'
            - 'button "มุมมองผนัง: ผนังด้านเหนือ"'
            - 'button "มุมมองผนัง: ผนังด้านใต้"'
            - 'button "มุมมองผนัง: ผนังด้านตะวันตก"'
            - 'button "มุมมองผนัง: ผนังด้านตะวันออก"'
            - group "ประตู" [ref=e135]
            - group "หน้าต่าง"
            - button "โซฟา, 2100 by 900 mm" [ref=e137]:
              - generic: โซฟา
            - button "โต๊ะกลาง, 1100 by 600 mm" [ref=e140]:
              - generic: โต๊ะกลาง
          - generic [ref=e143]:
            - generic [ref=e144]: สิ่งของ
            - generic [ref=e146]: แนวทางเดินตัวอย่าง
            - generic [ref=e148]: กดปุ่มลูกศรเพื่อขยับ 10 มม. · Shift + ลูกศร 50 มม.
      - complementary [ref=e149]:
        - tablist "แผงข้อมูล" [ref=e150]:
          - tab "รายการสิ่งของ" [ref=e151] [cursor=pointer]
          - tab "อุปกรณ์ติดผนัง" [ref=e152] [cursor=pointer]
          - tab "จุดที่ควรปรับปรุง" [active] [selected] [ref=e153] [cursor=pointer]
          - tab "ข้อเสนอแนะ" [ref=e154] [cursor=pointer]
          - tab "ผู้อยู่อาศัย" [ref=e155] [cursor=pointer]
        - generic [ref=e156]:
          - note [ref=e157]:
            - strong [ref=e158]: ชุดข้อมูลเกณฑ์อ้างอิงรุ่น 2026.10-draft
            - generic [ref=e159]: 24/24 ค่าที่ใช้อยู่ยังรอการตรวจทาน
          - region [ref=e160]:
            - generic [ref=e161]:
              - heading "การตรวจสอบทางเรขาคณิต" [level=2] [ref=e162]
              - paragraph [ref=e163]: ผลตรวจจากข้อมูลในแผนผัง ไม่ใช่การรับรองความปลอดภัย
              - generic "สรุปผลตรวจ" [ref=e164]:
                - generic [ref=e165]: "ควรตรวจดู: 2"
                - generic [ref=e166]: "ไม่พบความขัดแย้งในแบบจำลอง: 4"
                - generic [ref=e167]: "ยังไม่ได้ประเมิน: 2"
            - generic [ref=e168]:
              - article [ref=e169]:
                - generic [ref=e170]:
                  - generic [ref=e171]: G04
                  - strong [ref=e172]: ควรตรวจดู
                - paragraph [ref=e173]: แนวทางเดินที่วาดตัดกับสิ่งของทึบ
                - generic [ref=e174]:
                  - generic [ref=e175]:
                    - term [ref=e176]: ประเภทข้อมูล
                    - definition [ref=e177]: ข้อมูลแนวพื้นที่ที่กำหนดเอง
                  - generic [ref=e178]:
                    - term [ref=e179]: ความเชื่อมั่นของการวัด
                    - definition [ref=e180]: ประมาณการ
                  - generic [ref=e181]:
                    - term [ref=e182]: ขนาดที่ใช้ในแบบ
                    - definition [ref=e183]: 100 ซม.
                  - generic [ref=e184]:
                    - term [ref=e185]: ข้อจำกัดของการตรวจนี้
                    - definition [ref=e186]: ตรวจเฉพาะแนวทางเดินที่วาด ไม่ได้ยืนยันว่าเข้าถึงทุกจุดหมายได้
                - group "แนวทางแก้ไขที่แนะนำ" [ref=e187]:
                  - strong [ref=e188]: แนวทางแก้ไขที่แนะนำ
                  - 'button "ดูตัวอย่าง: ย้ายสิ่งของ" [ref=e189] [cursor=pointer]'
                  - 'button "ดูตัวอย่าง: นำสิ่งของออกจากห้อง" [ref=e190] [cursor=pointer]'
                - button "แสดงตำแหน่งในแผนผัง" [ref=e191] [cursor=pointer]
                - button "สร้างร่างข้อเสนอแนะ" [ref=e192] [cursor=pointer]
              - article [ref=e193]:
                - generic [ref=e194]:
                  - generic [ref=e195]: D01
                  - strong [ref=e196]: ควรตรวจดู
                - paragraph [ref=e197]: ช่องประตูแคบกว่าค่าเกณฑ์อ้างอิง
                - list "การเปรียบเทียบกับเกณฑ์อ้างอิง" [ref=e198]:
                  - listitem [ref=e199]:
                    - generic [ref=e200]:
                      - generic [aria-hidden] [ref=e201]: ✓
                      - strong [ref=e202]: น่าจะเป็นไปตามเกณฑ์
                      - generic [ref=e203]: ค่าเกณฑ์รอการตรวจทาน
                    - paragraph [ref=e204]: เกณฑ์อาคารสาธารณะ (กฎกระทรวง พ.ศ. 2548 แก้ไข 2564)
                    - paragraph [ref=e205]: "ความกว้างสุทธิของประตู · ข้อ 18(3) · ไม่น้อยกว่า 86 ซม. · ค่าที่บันทึก: 87 ซม."
                  - listitem [ref=e206]:
                    - generic [ref=e207]:
                      - generic [aria-hidden] [ref=e208]: ✕
                      - strong [ref=e209]: น่าจะไม่เป็นไปตามเกณฑ์
                      - generic [ref=e210]: ค่าเกณฑ์รอการตรวจทาน
                    - paragraph [ref=e211]: คำแนะนำสำหรับบ้าน (กรมกิจการผู้สูงอายุ)
                    - paragraph [ref=e212]: "ความกว้างสุทธิของประตู · คู่มือ: ประตู · ไม่น้อยกว่า 90 ซม. · ค่าที่บันทึก: 87 ซม."
                - paragraph [ref=e213]: ☞ ให้ผู้เชี่ยวชาญตรวจสอบ
                - generic [ref=e214]:
                  - generic [ref=e215]:
                    - term [ref=e216]: ประเภทข้อมูล
                    - definition [ref=e217]: การเปรียบเทียบกับเกณฑ์อ้างอิง
                  - generic [ref=e218]:
                    - term [ref=e219]: ความเชื่อมั่นของการวัด
                    - definition [ref=e220]: ประมาณการ
                  - generic [ref=e221]:
                    - term [ref=e222]: ขนาดที่ใช้ในแบบ
                    - definition [ref=e223]: 87 ซม.
                  - generic [ref=e224]:
                    - term [ref=e225]: ข้อจำกัดของการตรวจนี้
                    - definition [ref=e226]: เปรียบเทียบจากความกว้างสุทธิที่บันทึกไว้ ผู้วัดต้องหักความหนาของวงกบและบานประตูเอง
                - group "แนวทางแก้ไขที่แนะนำ" [ref=e227]:
                  - strong [ref=e228]: แนวทางแก้ไขที่แนะนำ
                  - 'button "ดูตัวอย่าง: ขยายช่องประตู" [ref=e229] [cursor=pointer]'
                - button "แสดงตำแหน่งในแผนผัง" [ref=e230] [cursor=pointer]
                - button "สร้างร่างข้อเสนอแนะ" [ref=e231] [cursor=pointer]
              - article [ref=e232]:
                - generic [ref=e233]:
                  - generic [ref=e234]: G05
                  - strong [ref=e235]: ยังไม่ได้ประเมิน
                - paragraph [ref=e236]: เพิ่มพื้นที่หมุนตัวและระบุเส้นผ่านศูนย์กลางหรือเป้าหมายเฉพาะโครงการ
                - generic [ref=e237]:
                  - generic [ref=e238]:
                    - term [ref=e239]: ประเภทข้อมูล
                    - definition [ref=e240]: เรขาคณิตที่กรอก
                  - generic [ref=e241]:
                    - term [ref=e242]: ความเชื่อมั่นของการวัด
                    - definition [ref=e243]: ประมาณการ
                  - generic [ref=e244]:
                    - term [ref=e245]: ข้อจำกัดของการตรวจนี้
                    - definition [ref=e246]: ตรวจเฉพาะวงกลมกับสี่เหลี่ยม ไม่ได้รับรองความสามารถในการหมุนตัว
                - button "แสดงตำแหน่งในแผนผัง" [ref=e247] [cursor=pointer]
                - button "สร้างร่างข้อเสนอแนะ" [ref=e248] [cursor=pointer]
              - article [ref=e249]:
                - generic [ref=e250]:
                  - generic [ref=e251]: D02
                  - strong [ref=e252]: ยังไม่ได้ประเมิน
                - paragraph [ref=e253]: ยังไม่ได้บันทึกมือจับของประตูนี้
                - list "การเปรียบเทียบกับเกณฑ์อ้างอิง" [ref=e254]:
                  - listitem [ref=e255]:
                    - generic [ref=e256]:
                      - generic [aria-hidden] [ref=e257]: "?"
                      - strong [ref=e258]: ยังไม่ได้ประเมิน
                      - generic [ref=e259]: ค่าเกณฑ์รอการตรวจทาน
                    - paragraph [ref=e260]: เกณฑ์อาคารสาธารณะ (กฎกระทรวง พ.ศ. 2548 แก้ไข 2564)
                    - paragraph [ref=e261]: ระดับมือจับประตู · ข้อ 18(7) · 100–120 ซม.
                  - listitem [ref=e262]:
                    - generic [ref=e263]:
                      - generic [aria-hidden] [ref=e264]: "?"
                      - strong [ref=e265]: ยังไม่ได้ประเมิน
                      - generic [ref=e266]: ค่าเกณฑ์รอการตรวจทาน
                    - paragraph [ref=e267]: คำแนะนำสำหรับบ้าน (กรมกิจการผู้สูงอายุ)
                    - paragraph [ref=e268]: "ระดับมือจับประตู · คู่มือ: ประตู · 100–120 ซม."
                  - listitem [ref=e269]:
                    - generic [ref=e270]:
                      - generic [aria-hidden] [ref=e271]: "?"
                      - strong [ref=e272]: ยังไม่ได้ประเมิน
                      - generic [ref=e273]: ค่าเกณฑ์รอการตรวจทาน
                    - paragraph [ref=e274]: เกณฑ์อาคารสาธารณะ (กฎกระทรวง พ.ศ. 2548 แก้ไข 2564)
                    - paragraph [ref=e275]: ชนิดมือจับประตู · ข้อ 18(7) · ก้านบิด
                  - listitem [ref=e276]:
                    - generic [ref=e277]:
                      - generic [aria-hidden] [ref=e278]: –
                      - strong [ref=e279]: ไม่มีค่าเกณฑ์อ้างอิง
                    - paragraph [ref=e280]: คำแนะนำสำหรับบ้าน (กรมกิจการผู้สูงอายุ)
                    - paragraph [ref=e281]: ชนิดมือจับประตู · คู่มือไม่ได้ระบุชนิดมือจับ
                - generic [ref=e282]:
                  - generic [ref=e283]:
                    - term [ref=e284]: ประเภทข้อมูล
                    - definition [ref=e285]: การเปรียบเทียบกับเกณฑ์อ้างอิง
                  - generic [ref=e286]:
                    - term [ref=e287]: ความเชื่อมั่นของการวัด
                    - definition [ref=e288]: ประมาณการ
                  - generic [ref=e289]:
                    - term [ref=e290]: ข้อจำกัดของการตรวจนี้
                    - definition [ref=e291]: เปรียบเทียบเฉพาะชนิดและระดับมือจับที่บันทึกไว้ ไม่ได้ทดสอบว่าบิดหรือจับได้ง่ายเพียงใด
                - group "แนวทางแก้ไขที่แนะนำ" [ref=e292]:
                  - strong [ref=e293]: แนวทางแก้ไขที่แนะนำ
                  - 'button "ดูตัวอย่าง: เปลี่ยนเป็นมือจับแบบก้านบิด" [ref=e294] [cursor=pointer]'
                - button "แสดงตำแหน่งในแผนผัง" [ref=e295] [cursor=pointer]
                - button "สร้างร่างข้อเสนอแนะ" [ref=e296] [cursor=pointer]
              - article [ref=e297]:
                - generic [ref=e298]:
                  - generic [ref=e299]: G01
                  - strong [ref=e300]: ไม่พบความขัดแย้งในแบบจำลอง
                - paragraph [ref=e301]: ขอบเขตสิ่งของที่ระบุอยู่ภายในขอบเขตห้อง
                - generic [ref=e302]:
                  - generic [ref=e303]:
                    - term [ref=e304]: ประเภทข้อมูล
                    - definition [ref=e305]: เรขาคณิตที่กรอก
                  - generic [ref=e306]:
                    - term [ref=e307]: ความเชื่อมั่นของการวัด
                    - definition [ref=e308]: ประมาณการ
                  - generic [ref=e309]:
                    - term [ref=e310]: ข้อจำกัดของการตรวจนี้
                    - definition [ref=e311]: ขนาดห้องและสิ่งของเป็นไปตามข้อมูลเรขาคณิตที่กรอกเท่านั้น
                - button "แสดงตำแหน่งในแผนผัง" [ref=e312] [cursor=pointer]
              - article [ref=e313]:
                - generic [ref=e314]:
                  - generic [ref=e315]: G02
                  - strong [ref=e316]: ไม่พบความขัดแย้งในแบบจำลอง
                - paragraph [ref=e317]: ไม่พบขอบเขตสิ่งของทึบทับซ้อนกัน
                - generic [ref=e318]:
                  - generic [ref=e319]:
                    - term [ref=e320]: ประเภทข้อมูล
                    - definition [ref=e321]: เรขาคณิตที่กรอก
                  - generic [ref=e322]:
                    - term [ref=e323]: ความเชื่อมั่นของการวัด
                    - definition [ref=e324]: ประมาณการ
                  - generic [ref=e325]:
                    - term [ref=e326]: ข้อจำกัดของการตรวจนี้
                    - definition [ref=e327]: ใช้สี่เหลี่ยมแทนสิ่งของอย่างระมัดระวัง ไม่ได้ประเมินความมั่นคงหรือการใช้งาน
                - button "แสดงตำแหน่งในแผนผัง" [ref=e328] [cursor=pointer]
              - article [ref=e329]:
                - generic [ref=e330]:
                  - generic [ref=e331]: G03
                  - strong [ref=e332]: ไม่พบความขัดแย้งในแบบจำลอง
                - paragraph [ref=e333]: ไม่พบสิ่งของทึบขวางส่วนโค้งเปิดประตูเข้าด้านในตามแบบจำลอง
                - generic [ref=e334]:
                  - generic [ref=e335]:
                    - term [ref=e336]: ประเภทข้อมูล
                    - definition [ref=e337]: เรขาคณิตที่กรอก
                  - generic [ref=e338]:
                    - term [ref=e339]: ความเชื่อมั่นของการวัด
                    - definition [ref=e340]: ประมาณการ
                  - generic [ref=e341]:
                    - term [ref=e342]: ข้อจำกัดของการตรวจนี้
                    - definition [ref=e343]: คำนวณส่วนโค้งหนึ่งในสี่วงกลมจากบานพับและความกว้างที่กรอก
                - button "แสดงตำแหน่งในแผนผัง" [ref=e344] [cursor=pointer]
              - article [ref=e345]:
                - generic [ref=e346]:
                  - generic [ref=e347]: D03
                  - strong [ref=e348]: ไม่พบความขัดแย้งในแบบจำลอง
                - paragraph [ref=e349]: ระดับธรณีประตูนี้อยู่ในเกณฑ์ที่มีค่ากำหนด
                - list "การเปรียบเทียบกับเกณฑ์อ้างอิง" [ref=e350]:
                  - listitem [ref=e351]:
                    - generic [ref=e352]:
                      - generic [aria-hidden] [ref=e353]: ✓
                      - strong [ref=e354]: น่าจะเป็นไปตามเกณฑ์
                      - generic [ref=e355]: ค่าเกณฑ์รอการตรวจทาน
                    - paragraph [ref=e356]: เกณฑ์อาคารสาธารณะ (กฎกระทรวง พ.ศ. 2548 แก้ไข 2564)
                    - paragraph [ref=e357]: "ระดับธรณีประตู · ข้อ 18(2) · ไม่เกิน 1.3 ซม. · ค่าที่บันทึก: 0 ซม."
                  - listitem [ref=e358]:
                    - generic [ref=e359]:
                      - generic [aria-hidden] [ref=e360]: ✓
                      - strong [ref=e361]: น่าจะเป็นไปตามเกณฑ์
                      - generic [ref=e362]: ค่าเกณฑ์รอการตรวจทาน
                    - paragraph [ref=e363]: คำแนะนำสำหรับบ้าน (กรมกิจการผู้สูงอายุ)
                    - paragraph [ref=e364]: "ระดับธรณีประตู · คู่มือ: ประตู · ไม่เกิน 2 ซม. · ค่าที่บันทึก: 0 ซม."
                - paragraph [ref=e365]: ☞ ให้ผู้เชี่ยวชาญตรวจสอบ
                - generic [ref=e366]:
                  - generic [ref=e367]:
                    - term [ref=e368]: ประเภทข้อมูล
                    - definition [ref=e369]: การเปรียบเทียบกับเกณฑ์อ้างอิง
                  - generic [ref=e370]:
                    - term [ref=e371]: ความเชื่อมั่นของการวัด
                    - definition [ref=e372]: ประมาณการ
                  - generic [ref=e373]:
                    - term [ref=e374]: ขนาดที่ใช้ในแบบ
                    - definition [ref=e375]: 0 ซม.
                  - generic [ref=e376]:
                    - term [ref=e377]: ข้อจำกัดของการตรวจนี้
                    - definition [ref=e378]: เปรียบเทียบเฉพาะความต่างระดับ การปาดขอบลาดเอียงบันทึกไว้เป็นหมายเหตุ ไม่ได้นำมาคำนวณ
                - button "แสดงตำแหน่งในแผนผัง" [ref=e379] [cursor=pointer]
            - paragraph [ref=e381]: ผลการตรวจนี้เป็นการเปรียบเทียบค่าที่บันทึกกับเกณฑ์อ้างอิงเท่านั้น ไม่ใช่การรับรอง กฎกระทรวงฯ บังคับใช้กับอาคารสาธารณะ ไม่ใช่บ้านพักอาศัยส่วนบุคคล งานโครงสร้างหรืองานที่ต้องขออนุญาตควรปรึกษาสถาปนิกหรือวิศวกรที่มีใบอนุญาต
          - region [ref=e382]:
            - heading "แนวทางเดินและพื้นที่หมุนตัว" [level=2] [ref=e384]
            - generic [ref=e385]:
              - button "วาดบนแผนผัง" [ref=e386] [cursor=pointer]
              - button "เพิ่มแนวทางเดิน" [ref=e387] [cursor=pointer]
              - button "วางบนแผนผัง" [ref=e388] [cursor=pointer]
              - button "เพิ่มพื้นที่หมุนตัว" [ref=e389] [cursor=pointer]
            - article [ref=e390]:
              - generic [ref=e391]:
                - strong [ref=e392]: แนวทางเดิน
                - button "นำออก" [ref=e393] [cursor=pointer]
              - generic [ref=e394]:
                - text: ป้ายชื่อ
                - textbox "ป้ายชื่อ" [ref=e395]: แนวทางเดินตัวอย่าง — ความกว้างเพื่อสาธิต
              - generic [ref=e396]:
                - text: ความกว้างแนวทางเดิน (ซม. ไม่บังคับ)
                - textbox "ความกว้างแนวทางเดิน (ซม. ไม่บังคับ)" [ref=e397]:
                  - /placeholder: —
                  - text: "100"
              - generic [ref=e398]:
                - group "จุด 1" [ref=e399]:
                  - generic [ref=e401]:
                    - generic [ref=e402]:
                      - text: X (ซม.)
                      - textbox "X (ซม.)" [ref=e403]: "50"
                    - generic [ref=e404]:
                      - text: Y (ซม.)
                      - textbox "Y (ซม.)" [ref=e405]: "50"
                - group "จุด 2" [ref=e406]:
                  - generic [ref=e408]:
                    - generic [ref=e409]:
                      - text: X (ซม.)
                      - textbox "X (ซม.)" [ref=e410]: "550"
                    - generic [ref=e411]:
                      - text: Y (ซม.)
                      - textbox "Y (ซม.)" [ref=e412]: "50"
              - generic [ref=e413]:
                - button "เพิ่มจุด" [ref=e414] [cursor=pointer]
                - button "บันทึกแนวพื้นที่" [ref=e415] [cursor=pointer]
            - paragraph [ref=e416]: ยังไม่มีพื้นที่หมุนตัว
          - region [ref=e417]:
            - heading "เป้าหมายเฉพาะโครงการ" [level=2] [ref=e418]
            - paragraph [ref=e419]: ค่าที่ผู้ให้คำปรึกษากรอกสำหรับโครงการนี้ ไม่ใช่ข้อกำหนดทางกฎหมายหรือมาตรฐานทั่วไป
            - article [ref=e420]:
              - generic [ref=e421]:
                - strong [ref=e422]: เป้าหมายความกว้างแนวทางเดิน (ซม.)
                - generic [ref=e423]: ยังไม่ได้ประเมิน
              - generic [ref=e424]:
                - text: เป้าหมายความกว้างแนวทางเดิน (ซม.)
                - textbox "เป้าหมายความกว้างแนวทางเดิน (ซม.)" [ref=e425]:
                  - /placeholder: เช่น 90
              - generic [ref=e426]:
                - text: ผู้บันทึก
                - textbox "ผู้บันทึก" [ref=e427]
              - generic [ref=e428]:
                - text: เหตุผลของเป้าหมายโครงการนี้
                - textbox "เหตุผลของเป้าหมายโครงการนี้" [ref=e429]
              - generic [ref=e430]:
                - text: ลิงก์แหล่งข้อมูล (ไม่บังคับ)
                - textbox "ลิงก์แหล่งข้อมูล (ไม่บังคับ)" [ref=e431]
              - button "บันทึกเป้าหมาย" [ref=e433] [cursor=pointer]
            - article [ref=e434]:
              - generic [ref=e435]:
                - strong [ref=e436]: เป้าหมายเส้นผ่านศูนย์กลางพื้นที่หมุนตัว (ซม.)
                - generic [ref=e437]: ยังไม่ได้ประเมิน
              - generic [ref=e438]:
                - text: เป้าหมายเส้นผ่านศูนย์กลางพื้นที่หมุนตัว (ซม.)
                - textbox "เป้าหมายเส้นผ่านศูนย์กลางพื้นที่หมุนตัว (ซม.)" [ref=e439]:
                  - /placeholder: เช่น 90
              - generic [ref=e440]:
                - text: ผู้บันทึก
                - textbox "ผู้บันทึก" [ref=e441]
              - generic [ref=e442]:
                - text: เหตุผลของเป้าหมายโครงการนี้
                - textbox "เหตุผลของเป้าหมายโครงการนี้" [ref=e443]
              - generic [ref=e444]:
                - text: ลิงก์แหล่งข้อมูล (ไม่บังคับ)
                - textbox "ลิงก์แหล่งข้อมูล (ไม่บังคับ)" [ref=e445]
              - button "บันทึกเป้าหมาย" [ref=e447] [cursor=pointer]
          - region [ref=e448]:
            - heading "เกณฑ์หลัก" [level=3] [ref=e449]
            - paragraph [ref=e450]: เกณฑ์หลักเป็นตัวกำหนดผลรวมของแต่ละรายการตรวจ หากไม่ตั้งค่า รายการจะถูกแจ้งเตือนเมื่อไม่เป็นไปตามเกณฑ์ใดเกณฑ์หนึ่ง การเปลี่ยนเกณฑ์หลักทำให้การทบทวนก่อนหน้าไม่เป็นปัจจุบัน
            - generic [ref=e451]:
              - text: เกณฑ์หลัก
              - combobox "เกณฑ์หลัก" [ref=e452]:
                - option "ไม่ได้ตั้งค่า" [selected]
                - option "เกณฑ์อาคารสาธารณะ (กฎกระทรวง พ.ศ. 2548 แก้ไข 2564)"
                - option "คำแนะนำสำหรับบ้าน (กรมกิจการผู้สูงอายุ)"
            - button "บันทึกเกณฑ์หลัก" [ref=e453] [cursor=pointer]
```

# Test source

```ts
  5   | 
  6   | const now = '2026-09-28T00:00:00.000Z'
  7   | const m = (valueMm: number) => ({ valueMm, confidence: 'estimated' })
  8   | 
  9   | /** A project file exactly as v1 wrote it. */
  10  | function v1File() {
  11  |   const layout = {
  12  |     room: { width: m(6000), depth: m(5000), height: m(2700) },
  13  |     openings: [{ id: 'entry-door', kind: 'door', wall: 'north', offset: m(300), width: m(900), height: m(2100), sill: m(0), threshold: m(0), operation: 'hinged-in', hinge: 'start' }],
  14  |     items: [{ id: 'sofa-1', catalogId: 'sofa', label: 'โซฟาเดิม', center: { xMm: 3000, yMm: 4200 }, width: m(2100), depth: m(900), height: m(850), rotationDeg: 0, finish: 'sage', obstruction: 'solid' }],
  15  |     routes: [], turningAreas: [],
  16  |   }
  17  |   return {
  18  |     schemaVersion: 1, id: 'v1-file', title: 'โครงการรุ่นหนึ่ง', createdAt: now, updatedAt: now, revision: 2,
  19  |     household: { province: 'เชียงใหม่', activities: [], mobilityAids: [], concerns: [], assistanceNotes: '', residentPreferences: '', budgetSatang: null },
  20  |     current: layout, proposed: null, targets: { routeWidth: null, turningDiameter: null }, recommendations: [],
  21  |     review: { reviewerName: 'ผู้ทบทวนเดิม', reviewedAt: now, projectRevision: 2 },
  22  |   }
  23  | }
  24  | 
  25  | async function openBathroomExample(page: Page) {
  26  |   await page.setViewportSize({ width: 1440, height: 900 })
  27  |   await page.goto('/')
  28  |   await page.getByRole('button', { name: 'เปิดตัวอย่างห้องน้ำ' }).click()
  29  |   await expect(page.getByRole('heading', { name: /ตัวอย่างห้องน้ำ/ })).toBeVisible()
  30  | }
  31  | 
  32  | const check = (page: Page, ruleId: string) => page.locator(`.inspector-sidebar [data-testid="check-result"][data-rule-id="${ruleId}"]`)
  33  | 
  34  | test('upgrades a v1 project file and a v1 saved project without touching the old data', async ({ page }) => {
  35  |   await page.goto('/')
  36  |   await page.locator('input[type="file"]').setInputFiles({ name: 'old.udhome.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1File())) })
  37  |   await expect(page.getByRole('heading', { name: 'โครงการรุ่นหนึ่ง' })).toBeVisible()
  38  |   await expect(page.locator('.item-list').getByRole('button', { name: /โซฟาเดิม/ })).toBeVisible()
  39  |   await expect(page.locator('[data-item-id="sofa-1"]')).toHaveAttribute('data-x-mm', '3000')
  40  |   // The old review covered checks without benchmarks, so it shows as outdated.
  41  |   await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  42  |   await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  43  |   await expect(page.locator('.review-panel')).toContainText('การทบทวนไม่เป็นปัจจุบัน')
  44  | 
  45  |   // The same project saved by v1 in the browser opens on the next visit, and its entry is left alone.
  46  |   const legacy = JSON.stringify({ storageVersion: 1, writeToken: 'old-token', project: v1File() })
  47  |   await page.evaluate((value) => { localStorage.clear(); localStorage.setItem('baan-yoo-dee.project.v1', value) }, legacy)
  48  |   await page.reload()
  49  |   await expect(page.getByText(/ถูกปรับรุ่นจากเวอร์ชันก่อนหน้า/)).toBeVisible()
  50  |   await page.getByRole('button', { name: /ทำโครงการต่อ/ }).click()
  51  |   await expect(page.getByRole('status').filter({ hasText: /ถูกปรับรุ่นจากเวอร์ชันก่อนหน้า/ })).toBeVisible()
  52  |   await page.locator('.item-list').getByRole('button', { name: /โซฟาเดิม/ }).click()
  53  |   await page.getByLabel('ตำแหน่ง X (ซม.)').fill('310')
  54  |   await expect(page.locator('.project-menu-wrap .save-state')).toHaveText('บันทึกบนอุปกรณ์นี้แล้ว', { timeout: 7000 })
  55  |   const stored = await page.evaluate(() => ({ v1: localStorage.getItem('baan-yoo-dee.project.v1'), v2: localStorage.getItem('baan-yoo-dee.project.v2') }))
  56  |   expect(stored.v1).toBe(legacy)
  57  |   expect(JSON.parse(stored.v2!).project.schemaVersion).toBe(2)
  58  | })
  59  | 
  60  | test('shows both benchmarks for the bathroom example and never a definite verdict', async ({ page }) => {
  61  |   await openBathroomExample(page)
  62  |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  63  |   await expect(page.getByTestId('benchmark-banner').first()).toContainText('2026.10-draft')
  64  |   for (const ruleId of ['D01', 'D03', 'B01', 'B02', 'B03']) await expect(check(page, ruleId)).toHaveAttribute('data-check-status', 'attention')
  65  |   await expect(check(page, 'B05')).toHaveAttribute('data-check-status', 'not-evaluated')
  66  |   await expect(check(page, 'B03')).toContainText('ยังไม่มีราวจับ')
  67  | 
  68  |   const doorWidth = check(page, 'D01')
  69  |   await expect(doorWidth.getByTestId('verdict')).toHaveCount(2)
  70  |   await expect(doorWidth.locator('[data-benchmark="th-public-building"]')).toContainText('ข้อ 18(3)')
  71  |   await expect(doorWidth.locator('[data-benchmark="th-public-building"]')).toContainText('น่าจะไม่เป็นไปตามเกณฑ์')
  72  |   await expect(doorWidth.locator('[data-benchmark="th-dop-home"]')).toContainText('คำแนะนำสำหรับบ้าน')
  73  |   await expect(doorWidth).toContainText('ให้ผู้เชี่ยวชาญตรวจสอบ')
  74  |   // "No benchmark value" is shown as such, not as a failure.
  75  |   await expect(check(page, 'B02').locator('[data-key="toilet.seatHeight"][data-benchmark="th-dop-home"]')).toHaveAttribute('data-outcome', 'no-value')
  76  |   await expect(page.locator('.inspector-sidebar [data-outcome="meets"], .inspector-sidebar [data-outcome="does-not-meet"]')).toHaveCount(0)
  77  |   await expect(page.locator('.inspector-sidebar .checks-disclaimer')).toContainText('ไม่ใช่การรับรอง')
  78  | 
  79  |   const axe = await new AxeBuilder({ page }).include('.inspector-sidebar').analyze()
  80  |   expect(axe.violations).toEqual([])
  81  |   await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-bathroom-2d.png') })
  82  | })
  83  | 
  84  | test('an advisor chooses the primary benchmark, which changes results and outdates the review', async ({ page }) => {
  85  |   await page.setViewportSize({ width: 1440, height: 900 })
  86  |   await page.goto('/')
  87  |   await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  88  |   await page.getByRole('button', { name: 'แก้ไขห้องปัจจุบัน' }).click()
  89  |   // Narrow the door to 870 mm: it meets the public-building width (860) but not the home one (900).
  90  |   await page.getByRole('button', { name: /^แก้ไข: ประตู/ }).click()
  91  |   const width = page.getByLabel('ความกว้างสุทธิของช่องเปิด (ซม.)', { exact: true })
  92  |   await width.fill('87')
  93  |   await width.press('Enter')
  94  |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  95  |   await expect(check(page, 'D01')).toHaveAttribute('data-check-status', 'attention')
  96  | 
  97  |   await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  98  |   await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  99  |   await page.getByLabel('ชื่อผู้ทบทวน (กรอกเอง)').fill('ผู้ทบทวน')
  100 |   await page.getByRole('button', { name: 'บันทึกการทบทวนสำหรับฉบับนี้' }).click()
  101 |   await expect(page.locator('.review-panel')).toContainText('ทบทวนฉบับปัจจุบันแล้ว')
  102 | 
  103 |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  104 |   const policy = page.locator('.inspector-sidebar .benchmark-policy')
> 105 |   await policy.getByLabel('เกณฑ์หลัก', { exact: true }).selectOption('th-public-building')
      |                                                         ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  106 |   await policy.getByLabel('ผู้เลือกเกณฑ์').fill('ที่ปรึกษาทดสอบ')
  107 |   await policy.getByRole('button', { name: 'บันทึกเกณฑ์หลัก' }).click()
  108 |   await expect(check(page, 'D01')).toHaveAttribute('data-check-status', 'clear')
  109 |   await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  110 |   await expect(page.locator('.review-panel')).toContainText('การทบทวนไม่เป็นปัจจุบัน')
  111 | })
  112 | 
  113 | test('previews and applies a fix as one undoable step', async ({ page }) => {
  114 |   await openBathroomExample(page)
  115 |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  116 |   await check(page, 'B01').locator('[data-fix-id="door-rehang-out"]').click()
  117 |   const preview = page.getByTestId('fix-preview')
  118 |   await expect(preview).toContainText('ระบบจะสร้างห้องหลังปรับปรุงจากห้องปัจจุบัน')
  119 |   await expect(preview.locator('[data-rule-id="B01"]')).toHaveAttribute('data-to', 'clear')
  120 |   await expect(preview).toContainText('ยังไม่มีราคาตั้งต้น')
  121 |   // Nothing is committed while the preview is open.
  122 |   await expect(page.getByRole('button', { name: 'หลังปรับปรุง' })).toHaveCount(0)
  123 |   const axe = await new AxeBuilder({ page }).include('[data-testid="fix-preview"]').analyze()
  124 |   expect(axe.violations).toEqual([])
  125 |   await preview.getByRole('button', { name: 'ใช้แนวทางนี้' }).click()
  126 | 
  127 |   await page.getByRole('button', { name: 'หลังปรับปรุง' }).click()
  128 |   await expect(check(page, 'B01')).toHaveAttribute('data-check-status', 'clear')
  129 |   await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  130 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toHaveCount(1)
  131 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toContainText('กลับบานประตูให้เปิดออกด้านนอก')
  132 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toContainText('ยังไม่ทราบค่าใช้จ่าย')
  133 | 
  134 |   await page.getByRole('button', { name: 'เลิกทำ' }).click()
  135 |   await expect(page.getByRole('button', { name: 'หลังปรับปรุง' })).toHaveCount(0)
  136 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toHaveCount(0)
  137 | })
  138 | 
  139 | test('adds a grab bar in the wall view and moves it by keyboard and by number', async ({ page }) => {
  140 |   await openBathroomExample(page)
  141 |   await page.getByRole('button', { name: 'มุมมองผนัง', exact: true }).click()
  142 |   await page.getByRole('button', { name: 'ผนังด้านตะวันออก', exact: true }).click()
  143 |   await page.getByRole('button', { name: 'เพิ่มบนผนังนี้' }).click()
  144 |   const bar = page.locator('.elevation-fixture')
  145 |   await expect(bar).toHaveCount(1)
  146 |   await expect(bar).toHaveAttribute('data-height-mm', '800')
  147 |   // Its benchmark band is drawn while it is selected; only the public-building benchmark has one.
  148 |   await expect(page.getByTestId('benchmark-band')).toHaveCount(1)
  149 |   await expect(page.getByTestId('benchmark-band')).toContainText('65–70')
  150 | 
  151 |   // Keyboard: 10 mm per press, 50 mm with Shift. 800 → 700 → 680.
  152 |   await bar.focus()
  153 |   await bar.press('Shift+ArrowDown')
  154 |   await bar.press('Shift+ArrowDown')
  155 |   await bar.press('ArrowDown')
  156 |   await bar.press('ArrowDown')
  157 |   await expect(bar).toHaveAttribute('data-height-mm', '680')
  158 |   await bar.press('Shift+ArrowRight')
  159 |   await expect(bar).toHaveAttribute('data-offset-mm', '950')
  160 | 
  161 |   // Number: the inspector shows the same values and accepts a new offset.
  162 |   const height = page.getByLabel('ระดับจุดอ้างอิงจากพื้น (ซม.)', { exact: true })
  163 |   await expect(height).toHaveValue('68')
  164 |   const offset = page.getByLabel('ระยะกึ่งกลางจากจุดเริ่มผนัง (ซม.)', { exact: true })
  165 |   await offset.fill('110')
  166 |   await offset.press('Enter')
  167 |   await expect(bar).toHaveAttribute('data-offset-mm', '1100')
  168 |   // A position off the wall is refused with a reason and nothing changes.
  169 |   await offset.fill('175')
  170 |   await offset.press('Enter')
  171 |   await expect(page.getByText('ตำแหน่งนี้อยู่นอกแนวผนังหรือสูงเกินเพดาน')).toBeVisible()
  172 |   await expect(bar).toHaveAttribute('data-offset-mm', '1100')
  173 |   await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-wall-elevation.png') })
  174 | 
  175 |   // Drag: down by about a third of the wall height.
  176 |   const box = (await bar.locator('.elevation-shape').boundingBox())!
  177 |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  178 |   await page.mouse.down()
  179 |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 5 })
  180 |   await page.mouse.up()
  181 |   expect(Number(await bar.getAttribute('data-height-mm'))).toBeLessThan(680)
  182 |   await page.getByRole('button', { name: 'เลิกทำ' }).click()
  183 |   await expect(bar).toHaveAttribute('data-height-mm', '680')
  184 | 
  185 |   // The plan shows the same fixture on the same wall, and the grab bar check now finds it.
  186 |   await page.getByRole('button', { name: 'แผนผัง 2 มิติ' }).click()
  187 |   const symbol = page.locator('.plan-fixture')
  188 |   await expect(symbol).toHaveAttribute('data-wall', 'east')
  189 |   await expect(symbol).toHaveAttribute('data-offset-mm', '1100')
  190 |   await expect(symbol).toHaveAttribute('data-height-mm', '680')
  191 |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  192 |   await expect(check(page, 'B03')).not.toContainText('ยังไม่มีราวจับ')
  193 | 
  194 |   // 3D draws it too.
  195 |   await page.getByRole('button', { name: 'มุมมอง 3 มิติ' }).click()
  196 |   await expect(page.getByTestId('room-scene-canvas')).toBeVisible()
  197 |   await page.waitForTimeout(600)
  198 |   await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-bathroom-3d.png') })
  199 | 
  200 |   // Undo all the way back removes the fixture.
  201 |   await page.getByRole('button', { name: 'แผนผัง 2 มิติ' }).click()
  202 |   for (let step = 0; step < 8 && await page.getByRole('button', { name: 'เลิกทำ' }).isEnabled(); step++) await page.getByRole('button', { name: 'เลิกทำ' }).click()
  203 |   await expect(page.locator('.plan-fixture')).toHaveCount(0)
  204 | })
  205 | 
```