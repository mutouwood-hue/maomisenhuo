await page.locator('body').waitFor();
return await tabbit.observe({frames: 'none', maxChars: 20000});
