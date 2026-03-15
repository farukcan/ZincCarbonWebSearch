# Kod Review Raporu

**Proje:** ZincCarbonWebSearch - MCP Web Arama Sunucusu  
**Tarih:** 2026-03-15  
**Review Yapan:** AI Assistant

---

## Genel Değerlendirme

Proje, Playwright tabanlı bir web arama MCP sunucusu olarak iyi tasarlanmış. Temel işlevsellik (DuckDuckGo + Google fallback) doğru implementasyon. Ancak bazı iyileştirme alanları ve potansiyel sorunlar mevcut.

---

## 📋 Dosya Bazlı İnceleme

### 1. `src/search.ts` (166 satır)

#### Güçlü Yönler
- ✅ DuckDuckGo ve Google için ayrı metotlar ile iyi kod organizasyonu
- ✅ Playwright browser/context yönetimi düzgün (init/close pattern)
- ✅ Fallback mekanizması iyi çalışıyor
- ✅ User-Agent ve locale ayarları ile bot tespitinden kaçınma çabası
- ✅ `extractDuckDuckGoUrl` fonksiyonu ile redirect URL'leri doğru parse ediliyor

#### Sorunlar ve Öneriler

| # | Önem | Sorun | Öneri |
|---|------|-------|-------|
| 1 | **Yüksek** | `limit` parametresi Google için URL'de kullanılıyor ancak sayfa içeriği sınırlanmıyor. Tüm sonuçlar yüklenip sonra kesiliyor - gereksiz bant genişliği ve gecikme. | `num` parametresi yerine pagination veya infinite scroll gerekebilir |
| 2 | **Orta** | Selector'lar website değişikliklerine karşı kırılgan: `'article[data-testid]'`, `'div.g:has(h3)'` gibi | Selector'lar değişebilir - daha dayanıklı selector'lar veya selector mapping eklenebilir |
| 3 | **Orta** | Google aramasında consent dialog için sadece İngilizce/Türkçe buton metinleri var | Diğer diller için de destek eklenebilir |
| 4 | **Orta** | `description` çekimi için kullanılan selector'lar çok genel: `'.VwiC3b, [data-sncf], [style*="-webkit-line-clamp"]'` | Daha spesifik selector'lar kullanılabilir |
| 5 | **Düşük** | `catch {}` blokları sessiz hatalar üretiyor | Hata seviyesine göre loglama eklense iyi olur |
| 6 | **Düşük** | Her arama için yeni sayfa oluşturuluyor (`context.newPage()`) | Bağlantı havuzlama veya tek sayfa kullanımı performansı artırabilir |

#### Güvenlik Değerlendirmesi
- ✅ Headless mode ile çalışması güvenli
- ✅ Harici URL'ler döndürülüyor, XSS riski yok
- ⚠️ `encodeURIComponent` kullanılmış ama sorgu doğrulaması yok - çok büyük sorgular sorun yaratabilir

---

### 2. `src/index.ts` (44 satır)

#### Güçlü Yönler
- ✅ CLI argument parsing düzgün
- ✅ Graceful shutdown (`SIGINT`, `SIGTERM`) uygulanmış
- ✅ Stdio ve HTTP modu desteği
- ✅ Port parsing hata kontrolü var

#### Sorunlar ve Öneriler

| # | Önem | Sorun | Öneri |
|---|------|-------|-------|
| 1 | **Yüksek** | HTTP modunda her istek için yeni `McpServer` ve `StreamableHTTPServerTransport` oluşturuluyor (`app.post` içinde) | Sunucu instance'ı app seviyesinde oluşturulmalı |
| 2 | **Orta** | `searchService` global scope'da ama `init()` hata olursa crash olabilir | Error handling eklenebilir |
| 3 | **Orta** | Port değeri için `parseInt` sonrası validation eksik (0, negatif, >65535 kontrolü yok) | Port validation eklense iyi olur |
| 4 | **Düşük** | `process.exit(0)` yerine `process.exitCode` kullanımı daha temiz olabilir | Düşünülebilir |

---

### 3. `src/server.ts` (41 satır)

#### Güçlü Yönler
- ✅ Zod validation kullanımı iyi
- ✅ Tool description ve input schema iyi dokümante edilmiş
- ✅ Basit ve net yapı

#### Sorunlar ve Öneriler

| # | Önem | Sorun | Öneri |
|---|------|-------|-------|
| 1 | **Orta** | Version hardcoded: `'1.0.0'` | package.json'dan alınabilir |
| 2 | **Düşük** | Tool için `title` ve `description` var ama daha detaylı açıklamalar eklenebilir | Gelecekteki扩展 için hazırlık |

---

### 4. `package.json` (29 satır)

#### Güçlü Yönler
- ✅ Modern Node.js ESM modunda (`"type": "module"`)
- ✅ Bin entry point tanımlı
- ✅ Temiz script yapısı

#### Sorunlar ve Öneriler

| # | Önem | Sorun | Öneri |
|---|------|-------|-------|
| 1 | **Orta** | `author` boş | Doldurulabilir |
| 2 | **Düşük** | License: `ISC` - daha yaygın olan `MIT` düşünülebilir | Tercih meselesi |
| 3 | **Düşük** | `express` bağımlılığı var ama sadece MCP SDK için gerekli görünüyor | Gerekli mi kontrol edilmeli |

---

### 5. `tsconfig.json` (26 satır)

#### Güçlü Yönler
- ✅ Strict mod açık
- ✅ `noUncheckedIndexedAccess` etkin
- ✅ `isolatedModules` ve `skipLibCheck` doğru ayarlanmış

#### Sorunlar ve Öneriler
- ✅ Konfigürasyon oldukça iyi, önemli bir sorun yok

---

## 🚨 Kritik Bulgular

### 1. HTTP Modunda Sunucu Instance Yönetimi (src/index.ts:28-34)
Her HTTP isteğinde yeni sunucu oluşturulması:
- Performans sorunu
- Resource sızıntısı riski
- Session state tutulamaması

```typescript
// Mevcut (sorunlu)
app.post('/mcp', async (req, res) => {
  const server = createServer(searchService); // Her istekte oluşturuluyor
  const transport = new StreamableHTTPServerTransport();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

---

## 📊 Metrikler

| Metrik | Değer |
|--------|-------|
| Toplam Satır (src/) | ~250 |
| Dosya Sayısı | 3 |
| TypeScript Strictness | ✅ Tam |
| Test Coverage | ❌ Yok |
| ESLint/Prettier | ❌ Yok |
| Error Handling | ⚠️ Kısmi |

---

## 🏆 Öneriler (Öncelik Sırası)

### Yüksek Öncelik
1. **HTTP modda sunucu instance'ını düzelt** - Her istekte yeniden oluşturma sorununu çöz
2. **Limit parametresini Google için doğru uygula** - Sayfa içinde sonuç sayısını sınırla

### Orta Öncelik
3. Port validation ekle
4. Selector'ları daha dayanıklı hale getir veya selector mapping ekle
5. Error logging seviyelerini iyileştir
6. package.json'da author/license güncelle

### Düşük Öncelik
7. Version'ı package.json'dan çek
8. Daha fazla dil desteği için consent dialog text'lerini genişlet
9. Browser pooling düşün (performans için)

---

## ✅ Sonuç

Kod genel olarak **iyi kalitede** ve çalışır durumda. TypeScript kullanımı, yapı organizasyonu ve temel işlevsellik düzgün. Ancak HTTP modunda sunucu instance yönetimi kritik bir sorun ve düzeltilmesi gerekiyor. Ayrıca web scraping selector'ları website değişikliklerine karşı kırılgan olduğundan bakım gerektirebilir.

**Genel Puan: 7.5/10**
