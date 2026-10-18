await page.getByRole('button',{name:'今日生活',exact:true}).click();
return {summary:await page.locator('.lf-sum').innerText(),heading:await page.locator('.lf-sum').locator('..').innerText()};