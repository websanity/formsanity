<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Validation;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Markup\Parser;
use WebSanity\FormSanity\Validation\Native;

final class NativeTest extends TestCase
{
	private static function control(string $attributes)
	{
		$form = Parser::parse('<!DOCTYPE html><form data-fs-form action="/x"><input name="f" ' . $attributes . '></form>');
		return $form->fields['f']->controls[0];
	}

	/** @return iterable<string, array{string, string, string, ?string}> */
	public static function cases(): iterable
	{
		yield 'required empty' => ['type="text" required', '', 'incomplete', 'required'];
		yield 'required filled' => ['type="text" required', 'x', 'valid', null];
		yield 'pattern on empty is valid' => ['type="text" pattern="[a-z]+"', '', 'valid', null];
		yield 'pattern anchored whole string' => ['type="text" pattern="[a-z]+"', 'abc1', 'incomplete', 'pattern'];
		yield 'pattern match' => ['type="text" pattern="[a-z]+"', 'abc', 'valid', null];
		yield 'pattern is case-sensitive' => ['type="text" pattern="[a-z]+"', 'ABC', 'incomplete', 'pattern'];
		yield 'minlength counts UTF-16 units' => ['type="text" minlength="3"', 'a😀', 'valid', null];
		yield 'maxlength counts UTF-16 units' => ['type="text" maxlength="2"', 'a😀', 'invalid', 'maxlength'];
		yield 'too short' => ['type="text" minlength="3"', 'ab', 'incomplete', 'minlength'];
		yield 'number bad input' => ['type="number"', 'abc', 'invalid', 'badinput'];
		yield 'number under min' => ['type="number" min="5"', '4', 'incomplete', 'min'];
		yield 'number over max' => ['type="number" max="5"', '6', 'invalid', 'max'];
		yield 'step from min base' => ['type="number" min="5" step="2"', '6', 'invalid', 'step'];
		yield 'step from min base ok' => ['type="number" min="5" step="2"', '9', 'valid', null];
		yield 'step from zero' => ['type="number" step="2"', '6', 'valid', null];
		yield 'step any' => ['type="number" step="any"', '6.37', 'valid', null];
		yield 'number default step is one' => ['type="number"', '1.5', 'invalid', 'step'];
		yield 'min and step together report min' => ['type="number" min="5" step="2"', '4', 'invalid', 'min'];
		yield 'date under min' => ['type="date" min="2026-01-10"', '2026-01-09', 'incomplete', 'min'];
		yield 'date step in days from min' => ['type="date" min="2026-01-01" step="7"', '2026-01-09', 'invalid', 'step'];
		yield 'date step ok' => ['type="date" min="2026-01-01" step="7"', '2026-01-15', 'valid', null];
		yield 'date bad input' => ['type="date"', '2026-13-01', 'invalid', 'badinput'];
		yield 'time over max' => ['type="time" max="17:00"', '17:30', 'invalid', 'max'];
		yield 'native email accepts a bare host' => ['type="email"', 'jans@websanity', 'valid', null];
		yield 'native email mismatch' => ['type="email"', 'jans@', 'incomplete', 'type.native'];
		yield 'native url mismatch' => ['type="url"', 'not a url', 'incomplete', 'type.native'];
		yield 'empty optional number' => ['type="number" min="5"', '', 'valid', null];
		yield 'pattern rejects a trailing newline' => ['type="text" pattern="[a-z]+"', "abc\n", 'incomplete', 'pattern'];
		yield 'reversed time bounds wrap: late evening' => ['type="time" min="22:00" max="06:00"', '23:00', 'valid', null];
		yield 'reversed time bounds wrap: early morning' => ['type="time" min="22:00" max="06:00"', '05:00', 'valid', null];
		yield 'reversed time bounds wrap: the min itself' => ['type="time" min="22:00" max="06:00"', '22:00', 'valid', null];
		yield 'reversed time bounds wrap: outside' => ['type="time" min="22:00" max="06:00"', '12:00', 'invalid', 'min'];
		yield 'month bad input' => ['type="month"', 'garbage', 'invalid', 'badinput'];
		yield 'month under min' => ['type="month" min="2026-01"', '2020-01', 'incomplete', 'min'];
		yield 'month step from min' => ['type="month" min="2026-01" step="3"', '2026-03', 'invalid', 'step'];
		yield 'month step ok' => ['type="month" min="2026-01" step="3"', '2026-04', 'valid', null];
		yield 'week bad input' => ['type="week"', '2026-W60', 'invalid', 'badinput'];
		yield 'week over max' => ['type="week" max="2026-W10"', '2026-W11', 'invalid', 'max'];
		yield 'week step from min' => ['type="week" min="2026-W01" step="2"', '2026-W02', 'invalid', 'step'];
		yield 'week step ok' => ['type="week" min="2026-W01" step="2"', '2026-W03', 'valid', null];
		yield 'month year floor' => ['type="month"', '99999-01', 'invalid', 'badinput'];
		yield 'week year floor' => ['type="week"', '99999-W01', 'invalid', 'badinput'];
	}

	#[DataProvider('cases')]
	public function testNativeVerdict(string $attributes, string $value, string $verdict, ?string $code): void
	{
		$result = Native::check(self::control($attributes), $value);
		self::assertSame($verdict, $result['verdict']->value);
		self::assertSame($code, $result['code']);
	}
}
