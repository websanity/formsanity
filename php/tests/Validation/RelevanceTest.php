<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Validation;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Markup\Parser;
use WebSanity\FormSanity\Payload\Normalizer;
use WebSanity\FormSanity\Validation\Relevance;

final class RelevanceTest extends TestCase
{
	private static function relevance(string $inner, array $payload): Relevance
	{
		$form = Parser::parse('<!DOCTYPE html><form data-fs-form action="/x">' . $inner . '</form>');
		return new Relevance($form, Normalizer::normalize($payload, [], $form));
	}

	public function testAFieldFollowsItsOwnExpression(): void
	{
		$inner = '<select name="color"><option value="">c</option><option value="Other">Other</option></select><input name="other" type="text" data-fs-relevant="color == \'Other\'">';
		self::assertFalse(self::relevance($inner, ['color' => ''])->isFieldRelevant('other'));
		self::assertTrue(self::relevance($inner, ['color' => 'Other'])->isFieldRelevant('other'));
	}

	public function testARegionGovernsEveryControlInsideIt(): void
	{
		$inner = '<input name="pay" type="text"><ul data-fs-relevant="pay == \'card\'"><li><input name="card" type="text"></li></ul>';
		self::assertFalse(self::relevance($inner, ['pay' => 'invoice'])->isFieldRelevant('card'));
		self::assertTrue(self::relevance($inner, ['pay' => 'card'])->isFieldRelevant('card'));
	}

	public function testMembersDecideForThemselvesAndTheSetReadsItsRelevantMembers(): void
	{
		$inner = '<input type="radio" name="member-type" value="Standard"><input type="radio" name="member-type" value="Student"><input type="radio" name="journal" value="Standard Print" data-fs-relevant="member-type == \'Standard\'"><input type="radio" name="journal" value="Reduced" data-fs-relevant="member-type == \'Student\'"><input type="radio" name="journal" value="Online">';
		$r = self::relevance($inner, ['member-type' => ['Student'], 'journal' => ['Standard Print']]);
		self::assertFalse($r->isControlRelevant('journal', 0));
		self::assertTrue($r->isControlRelevant('journal', 1));
		self::assertTrue($r->isFieldRelevant('journal'));
		self::assertSame([], $r->valueOf('journal'));
	}

	public function testAWhollyIrrelevantSetIsAnIrrelevantField(): void
	{
		$inner = '<input type="checkbox" name="on" value="on"><input type="checkbox" name="opts" value="a" data-fs-relevant="on == \'on\'"><input type="checkbox" name="opts" value="b" data-fs-relevant="on == \'on\'">';
		self::assertFalse(self::relevance($inner, ['on' => [], 'opts' => ['a']])->isFieldRelevant('opts'));
	}

	public function testOptionsAndTheNoChoiceSelect(): void
	{
		$inner = '<input name="fuel" type="text"><select name="charger"><option value="ccs" data-fs-relevant="fuel == \'electric\'">CCS</option><option value="chademo" data-fs-relevant="fuel == \'electric\'">CHAdeMO</option></select><select name="octane"><option value="">c</option><option value="93" data-fs-relevant="fuel == \'petrol\'">93</option></select>';
		$r = self::relevance($inner, ['fuel' => 'petrol', 'charger' => 'ccs', 'octane' => '93']);
		self::assertFalse($r->isFieldRelevant('charger'));
		self::assertTrue($r->isFieldRelevant('octane'));
		self::assertTrue($r->isOptionRelevant('octane', '93'));
		self::assertFalse($r->isOptionRelevant('charger', 'ccs'));
	}

	public function testMutualExclusionSettles(): void
	{
		$inner = '<input type="checkbox" name="roles" value="Head" data-fs-relevant="roles != \'Manager\'"><input type="checkbox" name="roles" value="Manager" data-fs-relevant="roles != \'Head\'">';
		$r = self::relevance($inner, ['roles' => ['Head']]);
		self::assertTrue($r->isControlRelevant('roles', 0));
		self::assertFalse($r->isControlRelevant('roles', 1));
		self::assertSame(['Head'], $r->valueOf('roles'));
	}

	private const string THREE_ROLES = '<input type="checkbox" name="roles" value="Manager" data-fs-relevant="roles != \'Driver\'"><input type="checkbox" name="roles" value="Driver" data-fs-relevant="roles != \'Manager\'"><input type="checkbox" name="roles" value="Medic">';

	public function testTwoMembersOfAThreeMemberSetExcludeEachOtherWhileTheThirdIsChecked(): void
	{
		$r = self::relevance(self::THREE_ROLES, ['roles' => ['Driver', 'Medic']]);
		self::assertFalse($r->isControlRelevant('roles', 0));
		self::assertTrue($r->isControlRelevant('roles', 1));
		self::assertTrue($r->isControlRelevant('roles', 2));
		self::assertSame(['Driver', 'Medic'], $r->valueOf('roles'));
	}

	public function testMembersThatDoNotSettleAreIrrelevant(): void
	{
		$r = self::relevance(self::THREE_ROLES, ['roles' => ['Manager', 'Driver', 'Medic']]);
		self::assertFalse($r->isControlRelevant('roles', 0));
		self::assertFalse($r->isControlRelevant('roles', 1));
		self::assertTrue($r->isControlRelevant('roles', 2));
		self::assertSame(['Medic'], $r->valueOf('roles'));
		self::assertTrue($r->excludes('roles', 'Manager'));
	}

	public function testEqualityOnAListFieldIsMembershipOverItsRelevantAnswers(): void
	{
		$inner = '<input type="checkbox" name="on" value="on"><input type="checkbox" name="opts" value="a,b"><input type="checkbox" name="opts" value="c" data-fs-relevant="on == \'on\'"><input type="checkbox" name="opts" value="d"><select name="many" multiple><option value="x">x</option><option value="y">y</option></select><input name="color" type="text"><input type="checkbox" name="none" value="n">'
			. '<input name="t1" type="text" data-fs-relevant="opts == \'a,b\'"><input name="t2" type="text" data-fs-relevant="opts == \'a\'"><input name="t3" type="text" data-fs-relevant="opts == \'c\'"><input name="t4" type="text" data-fs-relevant="many == \'y\'"><input name="t5" type="text" data-fs-relevant="color == \'a\'"><input name="t6" type="text" data-fs-relevant="none == \'\'"><input name="t7" type="text" data-fs-relevant="opts != \'d\'"><input name="t8" type="text" data-fs-relevant="opts != \'\'">';
		$r = self::relevance($inner, ['on' => [], 'opts' => ['a,b', 'c', 'd'], 'many' => ['x', 'y'], 'color' => 'a,b']);
		self::assertSame(['a,b', 'd'], $r->values('opts'));
		self::assertNull($r->values('color'));
		self::assertNull($r->values('nothing'));
		self::assertSame([], $r->values('none'));
		self::assertTrue($r->isFieldRelevant('t1'));
		self::assertFalse($r->isFieldRelevant('t2'));
		self::assertFalse($r->isFieldRelevant('t3'));
		self::assertTrue($r->isFieldRelevant('t4'));
		self::assertFalse($r->isFieldRelevant('t5'));
		self::assertTrue($r->isFieldRelevant('t6'));
		self::assertFalse($r->isFieldRelevant('t7'));
		self::assertTrue($r->isFieldRelevant('t8'));
	}
}
