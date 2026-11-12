# Informacje techniczne

Szczegóły dla osób, które chcą wiedzieć, jak to działa lub rozwijać integrację. Zwykły użytkownik ich nie potrzebuje — zob. [README](../README.md).

## Co zmieniłem względem oryginału (i dlaczego)

Centrala HYBRID mówi tym samym protokołem, ale jest bardziej wymagająca niż Smart HUB:

1. **ID użytkownika i urządzenia w nagłówku.** Centrala odpowiada na logowanie własnymi
   `userId`/`deviceId` i wymaga ich w nagłówku każdego następnego żądania. Oryginał wpisywał
   na sztywno 2 i 4, więc HYBRID odrzucała wszystko błędami 100/101 i odsyłała puste odpowiedzi.
   Teraz klient zapamiętuje wartości z odpowiedzi logowania.
2. **Spokojniejsze subskrypcje.** HYBRID zamyka sesję, gdy żądania przychodzą seriami.
   Subskrypcje idą co 1,2 s (stan, konfiguracja, status centrali, tryby uzbrajania, sieć).
3. **Podtrzymywanie sesji.** HYBRID zamyka sesję po krótkiej ciszy, więc osobny wątek co 1,5 s
   wysyła lekkie zapytanie o stan. Przy okazji centrala sama przysyła zmiany.
4. **Tryby uzbrajania.** Lista trybów jest czytana z centrali. Stan każdego trybu jest
   wyliczany ze znacznika „uzbrojony" urządzeń, które do niego należą. „Pełne czuwanie"
   pomija urządzenia, których nie da się uzbroić (pilot, wejście sabotażowe).
5. **Stan „uzbrajanie".** Komenda uzbrojenia nie jest powtarzana, gdy centrala nie potwierdza
   jej natychmiast (opóźnienie wyjścia); encja pokazuje „uzbrajanie" do 90 s.

## Testy bez Home Assistant

Klient protokołu działa samodzielnie (`pip install cryptography`):

```bash
python3 custom_components/bewave/bewave_client.py status --host 192.168.1.50 --login USER --password 'PASS'
```

## Jak działa protokół (skrót)

| Etap | Klucz | AAD |
|------|-------|-----|
| logowanie aplikacja → centrala | MD5(hasło)·2 | login |
| logowanie centrala → aplikacja | deviceUuid (ASCII, 32 B) | MD5(login dopełniony do 64) |
| polecenia aplikacja → centrala | deviceUuid | MD5(sessionId) |
| stan centrala → aplikacja | sessionSecret (`f4` z odpowiedzi) | MD5(sessionId) |

IV = `randomNumber ‖ timestamp ‖ counter` (BE32), AES-256-GCM, tag 16 B. Wiadomości to protobuf;
nagłówek zawiera m.in. `userId`/`deviceId`, `counter`, `timestamp`, `randomNumber` oraz w odpowiedzi
`status`/`error`. Żądania: `f24` ping, `f26` status, `f44` konfiguracja, `f52` tryby, `f88` stan
urządzeń; uzbrajanie: `f94{f1{f1{f1=id trybu, f2=1|0}}}`. Stan urządzenia: pole 20 (`1`/`2` uzbrojone).

---
