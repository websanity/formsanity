<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Markup;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\AuthoringError;
use WebSanity\FormSanity\Markup\Parser;

final class ParserTest extends TestCase
{
	private static function wrap(string $inner): string
	{
		return '<!DOCTYPE html><html><body><form data-fs-form action="/submit" method="post">' . $inner . '</form></body></html>';
	}

	public function testFieldsAreKeyedByNameInDocumentOrder(): void
	{
		$form = Parser::parse(self::wrap('<ul><li><label for="b">B</label><input id="b" name="b" type="text"></li><li><label for="a">A</label><input id="a" name="a" type="text" required minlength="2"></li></ul>'));
		self::assertSame(['b', 'a'], array_keys($form->fields));
		self::assertFalse($form->hasFileInput);
		self::assertTrue($form->fields['a']->nativeRequired);
		self::assertSame('2', $form->fields['a']->controls[0]->native['minlength']);
		self::assertFalse($form->fields['a']->set);
	}

	public function testAChoiceGroupIsOneFieldWithItsMembers(): void
	{
		$form = Parser::parse(self::wrap('<fieldset class="fs-toggles"><ul><li><label><input type="checkbox" name="colors" value="Red" data-fs-min-selected="1"></label></li><li><label><input type="checkbox" name="colors" value="Blue" data-fs-relevant="tier == \'pro\'"></label></li></ul></fieldset><input name="tier" type="text">'));
		$colors = $form->fields['colors'];
		self::assertTrue($colors->set);
		self::assertCount(2, $colors->controls);
		self::assertSame(['Red', 'Blue'], array_map(fn ($c) => $c->value, $colors->controls));
		self::assertNull($colors->controls[0]->relevant);
		self::assertNotNull($colors->controls[1]->relevant);
		self::assertSame('min-selected', $colors->rules[0]->kind);
		self::assertSame('1', $colors->rules[0]->param);
	}

	public function testRegionsHoldTheControlsInsideThem(): void
	{
		$form = Parser::parse(self::wrap('<input name="pay" type="text"><ul data-fs-relevant="pay == \'card\'"><li><input name="card" type="text"></li><li><input name="cvv" type="text"></li></ul><p data-fs-relevant="pay == \'invoice\'">Note</p>'));
		self::assertCount(2, $form->regions);
		self::assertSame([0], $form->fields['card']->controls[0]->regionIndexes);
		self::assertSame([0], $form->fields['cvv']->controls[0]->regionIndexes);
		self::assertSame([], $form->fields['pay']->controls[0]->regionIndexes);
	}

	public function testConditionalOptionsAreRecordedOnTheirSelect(): void
	{
		$form = Parser::parse(self::wrap('<input name="country" type="text"><select name="region"><option value="">choose</option><option value="CA-ON" data-fs-relevant="country == \'CA\'">Ontario</option></select>'));
		$options = $form->fields['region']->controls[0]->options;
		self::assertSame(['', 'CA-ON'], array_keys($options));
		self::assertNull($options['']);
		self::assertNotNull($options['CA-ON']);
		self::assertSame('select', $form->fields['region']->controls[0]->type);
	}

	public function testASelectMultipleAndAFileInput(): void
	{
		$form = Parser::parse(self::wrap('<select name="sizes" multiple><option value="S">S</option></select><input name="attachment" type="file" accept=".pdf" data-fs-max-file-size="2MB" multiple>'));
		self::assertSame('select-multiple', $form->fields['sizes']->controls[0]->type);
		self::assertTrue($form->hasFileInput);
		self::assertTrue($form->fields['attachment']->controls[0]->multiple);
		$kinds = array_map(fn ($r) => $r->kind, $form->fields['attachment']->rules);
		sort($kinds);
		self::assertSame(['accept', 'max-file-size'], $kinds);
	}

	public function testCompoundControlsAreSeparateFields(): void
	{
		$form = Parser::parse(self::wrap('<li><span id="n">Name</span><div class="fs-compound"><input name="first" data-fs-type="alpha" aria-labelledby="n"><input name="last" data-fs-type="alpha" aria-labelledby="n"></div></li>'));
		self::assertSame(['first', 'last'], array_keys($form->fields));
		self::assertSame('alpha', $form->fields['first']->type);
	}

	public function testAHiddenInputIsAField(): void
	{
		$form = Parser::parse(self::wrap('<input type="hidden" name="csrf" value="tok">'));
		self::assertSame('hidden', $form->fields['csrf']->controls[0]->type);
	}

	public function testGroupsAndConditionalRequirednessAndUniqueness(): void
	{
		$form = Parser::parse(self::wrap('<input name="home" type="text" data-fs-group-required-any="phone"><input name="mobile" type="text" data-fs-group-required-any="phone" data-fs-unique="/api/unique"><input name="contact" type="text"><input name="phone" type="text" data-fs-required="contact == \'phone\'"><input name="email" type="text" required data-fs-required="contact == \'email\'">'));
		self::assertCount(1, $form->groups);
		self::assertSame('required-any', $form->groups[0]->kind);
		self::assertSame(['home', 'mobile'], $form->groups[0]->members);
		self::assertSame('/api/unique', $form->fields['mobile']->uniqueUrl);
		self::assertNotNull($form->fields['phone']->required);
		self::assertNull($form->fields['email']->required);
		self::assertTrue($form->fields['email']->nativeRequired);
	}

	public function testAuthoringErrorsThrowAtParseTime(): void
	{
		foreach ([
			'<input name="a" type="text" data-fs-relevant="b = \'x\'">',
			'<input name="a" type="text" data-fs-type="postcode">',
			'<input name="a" type="file" data-fs-max-file-size="2 gigs">',
			'<input name="a" type="text" pattern="([">',
		] as $inner) {
			try {
				Parser::parse(self::wrap($inner));
				self::fail('Expected an AuthoringError for ' . $inner);
			} catch (AuthoringError) {
				$this->addToAssertionCount(1);
			}
		}
		$this->expectException(AuthoringError::class);
		Parser::parse('<!DOCTYPE html><html><body><form action="/x"></form></body></html>');
	}
}
