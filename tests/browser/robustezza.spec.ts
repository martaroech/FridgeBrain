import {test,expect} from "./supporto";
import type {Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function vai(pagina:Page,nome:string){await pagina.getByRole("navigation",{name:"Navigazione principale"}).getByRole("button",{name:nome,exact:true}).click();}

test("la spesa resta integra dopo un errore IndexedDB e si salva al tentativo seguente",async({page:pagina})=>{
  await pagina.goto("/FridgeBrain/");await vai(pagina,"Spesa");
  await pagina.getByLabel("Cosa manca?").fill("Limoni");
  await pagina.evaluate(()=>{
    const originale=IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add=function(...argomenti){
      if(this.name==="spesa"){IDBObjectStore.prototype.add=originale;throw new DOMException("Spazio esaurito nella prova","QuotaExceededError");}
      return originale.apply(this,argomenti);
    };
  });
  await pagina.getByRole("button",{name:"Aggiungi alla spesa"}).click();
  await expect(pagina.getByRole("alert",{name:"Errore"})).toContainText("Spazio");
  await pagina.getByRole("button",{name:"Aggiungi alla spesa"}).click();
  await expect(pagina.getByRole("checkbox",{name:"Segna acquistato: Limoni"})).toHaveCount(1);
  await pagina.reload();await expect(pagina.getByRole("checkbox",{name:"Segna acquistato: Limoni"})).toHaveCount(1);
});

test("accessibilità delle schermate principali e navigazione da tastiera", async ({
  page: pagina,
}) => {
  await pagina.goto("/FridgeBrain/");
  await expect(pagina.getByRole("heading", { level: 1 })).toBeVisible();
  await pagina.keyboard.press("Tab");
  await expect(
    pagina.getByRole("link", { name: "Vai al contenuto" }),
  ).toBeFocused();
  await pagina.keyboard.press("Enter");
  await expect(pagina.getByRole("main")).toBeFocused();
  for (const nome of ["Home", "Inventario", "Aggiungi", "Ricette", "Spesa"]) {
    await vai(pagina, nome);
    const risultato = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(risultato.violations, nome).toEqual([]);
  }
  await pagina
    .getByRole("button", { name: "Impostazioni", exact: true })
    .click();
  expect(
    (
      await new AxeBuilder({ page: pagina })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const risposta = await pagina.goto("/FridgeBrain/pagina-inesistente");
  expect(risposta?.status()).toBe(404);
  await expect(
    pagina.getByRole("heading", { name: "Questa pagina non c’è." }),
  ).toBeVisible();
  await pagina.getByRole("link", { name: "Torna alla Home" }).click();
  await expect(pagina.getByRole("heading", { level: 1 })).toContainText(
    "Buono per te",
  );
});
