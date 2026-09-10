<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Validation;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Form;

final class RulesTest extends TestCase
{
	private static function errors(string $inner, array $payload, array $files = []): array
	{
		$result = Form::parse('<!DOCTYPE html><form data-fs-form action="/x">' . $inner . '</form>')->validate($payload, $files);
		return array_map(fn ($e) => [$e['field'], $e['code']], $result->errors());
	}

	public function testAConstraintJudgesAnswersNotAbsence(): void
	{
		$inner = '<input name="password" type="password"><input name="confirm" type="password" data-fs-constraint="confirm == password">';
		self::assertSame([], self::errors($inner, ['password' => 'hunter22', 'confirm' => '']));
		self::assertSame([['confirm', 'constraint']], self::errors($inner, ['password' => 'hunter22', 'confirm' => 'hunter2']));
		self::assertSame([], self::errors($inner, ['password' => 'hunter22', 'confirm' => 'hunter22']));
	}

	public function testConditionalRequiredness(): void
	{
		$inner = '<input type="radio" name="contact" value="email"><input type="radio" name="contact" value="phone"><input name="phone" type="text" data-fs-required="contact == \'phone\'">';
		self::assertSame([], self::errors($inner, ['contact' => ['email'], 'phone' => '']));
		self::assertSame([['phone', 'required']], self::errors($inner, ['contact' => ['phone'], 'phone' => '']));
		self::assertSame([], self::errors($inner, ['contact' => [], 'phone' => '']));
	}

	public function testGroups(): void
	{
		$any = '<input name="home" type="text" data-fs-group-required-any="p"><input name="mobile" type="text" data-fs-group-required-any="p">';
		self::assertSame([['home', 'group.required-any'], ['mobile', 'group.required-any']], self::errors($any, []));
		self::assertSame([], self::errors($any, ['mobile' => '5551212']));
		$together = '<input name="first" type="text" data-fs-group-required-together="n"><input name="last" type="text" data-fs-group-required-together="n">';
		self::assertSame([], self::errors($together, []));
		self::assertSame([['last', 'group.required-together']], self::errors($together, ['first' => 'A']));
	}

	public function testSelectionCountsReadRelevantMembers(): void
	{
		$inner = '<input type="checkbox" name="on" value="on"><input type="checkbox" name="t" value="a" data-fs-min-selected="1" data-fs-max-selected="2"><input type="checkbox" name="t" value="b"><input type="checkbox" name="t" value="c" data-fs-relevant="on == \'on\'">';
		self::assertSame([['t', 'min-selected']], self::errors($inner, ['t' => []]));
		self::assertSame([], self::errors($inner, ['t' => ['a', 'b']]));
		self::assertSame([['t', 'max-selected']], self::errors($inner, ['on' => ['on'], 't' => ['a', 'b', 'c']]));
	}

	public function testASetRequiredByAnyMemberIsMetByAnyRelevantMember(): void
	{
		$inner = '<input type="radio" name="m" value="S"><input type="radio" name="m" value="T"><input type="radio" name="j" value="Print" required data-fs-relevant="m == \'S\'"><input type="radio" name="j" value="Online">';
		self::assertSame([['j', 'required']], self::errors($inner, ['m' => ['T'], 'j' => []]));
		self::assertSame([], self::errors($inner, ['m' => ['T'], 'j' => ['Online']]));
	}

	public function testPasswordCompositionAndOrderedBounds(): void
	{
		$inner = '<input name="pw" type="password" data-fs-min-digits="1" data-fs-min-uppercase="1"><input name="len" type="text" data-fs-type="duration" data-fs-min="0:30" data-fs-max="4:00">';
		self::assertSame([['pw', 'min-digits']], self::errors($inner, ['pw' => 'Abcdef']));
		self::assertSame([], self::errors($inner, ['pw' => '']));
		self::assertSame([['len', 'min']], self::errors($inner, ['len' => '0:15']));
		self::assertSame([['len', 'max']], self::errors($inner, ['len' => '5:00']));
		self::assertSame([['len', 'type.duration']], self::errors($inner, ['len' => '1:75']));
	}

	public function testDailyTimeWindow(): void
	{
		$inner = '<input name="m" type="datetime-local" data-fs-min-time="09:00" data-fs-max-time="17:00">';
		self::assertSame([], self::errors($inner, ['m' => '2026-06-01T10:00']));
		self::assertSame([['m', 'min-time']], self::errors($inner, ['m' => '2026-06-01T08:00']));
		self::assertSame([['m', 'max-time']], self::errors($inner, ['m' => '2026-06-01T18:00']));
		$wrap = '<input name="m" type="datetime-local" data-fs-min-time="22:00" data-fs-max-time="02:00">';
		self::assertSame([], self::errors($wrap, ['m' => '2026-06-01T23:00']));
		self::assertSame([['m', 'min-time']], self::errors($wrap, ['m' => '2026-06-01T12:00']));
	}

	public function testUniqueValuesAcrossTheForm(): void
	{
		$inner = '<input name="a" type="text" data-fs-group-unique-values="c"><input name="b" type="text" data-fs-group-unique-values="c">';
		self::assertSame([['a', 'group.unique-values'], ['b', 'group.unique-values']], self::errors($inner, ['a' => 'x', 'b' => 'x']));
		self::assertSame([], self::errors($inner, ['a' => '', 'b' => '']));
	}

	public function testFileRules(): void
	{
		$inner = '<input name="f" type="file" accept=".pdf,image/*" data-fs-max-file-size="1KB" required>';
		$file = fn (string $name, string $type, int $size) => ['name' => $name, 'type' => $type, 'size' => $size, 'tmp_name' => '/tmp/x', 'error' => 0];
		self::assertSame([['f', 'required']], self::errors($inner, [], []));
		self::assertSame([], self::errors($inner, [], ['f' => $file('a.PDF', 'application/pdf', 100)]));
		self::assertSame([], self::errors($inner, [], ['f' => $file('a.png', 'image/png', 100)]));
		self::assertSame([['f', 'file.accept']], self::errors($inner, [], ['f' => $file('a.txt', 'text/plain', 100)]));
		self::assertSame([['f', 'file.max-size']], self::errors($inner, [], ['f' => $file('a.pdf', 'application/pdf', 2048)]));
	}
}
